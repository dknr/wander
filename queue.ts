import { DB, QueryParameterSet } from "https://deno.land/x/sqlite@v3.7.2/mod.ts";

export type QueueTaskId = number;
export type QueueTask = {
    id: QueueTaskId;
    type: 'txt2img';
    seed: number;
    width: number;
    height: number;
    prompt: string;
    negative_prompt: string;
    guidance_scale: number;
    num_inference_steps: number;
};
export type QueueTaskRecord = {
  id: QueueTaskId;
  task: Omit<QueueTask, "id">;
  priority: number;
  request_time: number;
  start_time: number;
  finish_time: number;
  result_path: string;
};

const sql = {
  createTableTasks: `
create table if not exists tasks (
    id integer primary key autoincrement,
    task text not null,
    priority not null,
    request_time integer not null,
    start_time integer null,
    finish_time integer null,
    result_path text null
)
`,
  insertTask: `
insert into tasks (
  task, priority, request_time
) values (
  ?, ?, ?
) returning id
`,
  selectNextTask: `
select id, task
  from tasks
 where start_time is null
   and finish_time is null
 order by priority desc
     , request_time
 limit 1
`,
  updateTaskStart: `
update tasks
   set start_time = ?
 where id = ?
`,
  updateTaskFinish: `
update tasks
   set finish_time = ?
     , result_path = ?
 where id = ?
`,
  updateTaskPriority: `
update tasks
   set priority = ?
 where id = ?
`,
  selectTaskCount: `
select count(*)
  from tasks
 where start_time is null
   and finish_time is null
`,
  selectTaskById: `
select task
     , priority
     , request_time
     , start_time
     , finish_time
     , result_path
  from tasks
 where id = ?`
};

const now = () => new Date().getTime();

const openDatabase = (rootPath: string) => {
  Deno.mkdir("data", {recursive: true});
  const db = new DB(`${rootPath}/wander.db`);
  db.query(sql.createTableTasks);
  return db;
};

export const openQueue = (rootPath: string) => {
  const db = openDatabase(rootPath);
  const selectTaskRecords = (where: string, order?: string, limit?: number): QueueTaskRecord[] => {
    const results = db.query<[number, string, number, number, number, string, number]>(
      `select id, task, request_time, start_time, finish_time, result_path, priority from tasks where ${where}${order ? ` order by ${order}` : ''}${limit ? ` limit ${limit}` : ''}`
    );
    return results.map((result): QueueTaskRecord => ({
      id: result[0],
      task: JSON.parse(result[1]) as QueueTask,
      request_time: result[2],
      start_time: result[3],
      finish_time: result[4],
      result_path: result[5],
      priority: result[6]
    }));
  }

  return {
    addTask: (task: Omit<QueueTask, "id">, priority = 0): QueueTaskId => {
      const json = JSON.stringify(task);
      return db.query(sql.insertTask, [json, priority, now()])[0][0] as number;
    },
    getTask: (id: QueueTaskId): QueueTaskRecord | null => {
      const results = db.query(sql.selectTaskById, [id]);
      if (results.length < 1) return null;

      const result = results[0];
      // const [taskJson, priority, request_time, start_time, finish_time, result_path] = result;
      return {
        id,
        task: JSON.parse(result[0] as string),
        priority: result[1] as number,
        request_time: result[2] as number,
        start_time: result[3] as number,
        finish_time: result[4] as number,
        result_path: result[5] as string,
      }
    },
    setTaskPriority: (id: QueueTaskId, priority: number) => {
      db.query(sql.updateTaskPriority, [priority, id]);
    },
    getLength: () => {
      return db.query(sql.selectTaskCount)[0][0] as number;
    },
    startNextTask: (): QueueTask | null => {
      const results = db.query(sql.selectNextTask);
      if (results.length < 1) return null;
      const result = results[0];
      const id = result[0] as number;
      const task = JSON.parse(result[1] as string);
      db.query(sql.updateTaskStart, [now(), id]);
      return {...task, id};
    },
    finishTask: (id: QueueTaskId, result_path: string) => {
      db.query(
        sql.updateTaskFinish,
        [now(), result_path, id],
      )
    },
    peek: (id: number): QueueTaskRecord | null => {
      const results = db.query<[number, string, number, number, number, string, number]>(
        `select id, task, request_time, start_time, finish_time, result_path, priority from tasks where id = ?`,
        [id],
      );
      if (results.length < 1) return null;
      const result = results[0];
      return {
        id: result[0],
        task: JSON.parse(result[1]) as QueueTask,
        request_time: result[2],
        start_time: result[3],
        finish_time: result[4],
        result_path: result[5],
        priority: result[6]
      };
    },
    peekNext: (count: number) =>  selectTaskRecords('start_time is null and finish_time is null', "priority desc, request_time", count),
    peekLast: (count: number) => selectTaskRecords('finish_time is not null', 'finish_time desc', count),
    peekActive: () => selectTaskRecords('start_time is not null and finish_time is null', 'start_time'),
  };
};



export const openQueueReader = openQueue;
export type TaskQueue = ReturnType<typeof openQueue>;
