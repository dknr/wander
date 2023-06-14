import { QueueTask, QueueTaskRecord, TaskQueue } from "./queue.ts";

const html = (body: string) =>
  `<!DOCTYPE html>
<html>
<body>
${body}
</body>
</html>
`;

const taskline = (record: QueueTaskRecord) => `
<div style="display: flex; flex-direction: row; border: 1px solid black; border-radius: 4px; margin: 8px; width: 480px; padding-left: 8px;">
  <div style="flex-grow: 1; display: flex; flex-direction: column; justify-items: space-between">
    <p> ${record.task.prompt}</p>
    <a href='${`/task/${record.id}`}'>
      <pre>${record.id.toString().padStart(4)} - ${record.task.num_inference_steps.toString()}@${
        (record.task.width + "x" + record.task.height).padStart(8)
      }</pre>
    </a>
  </div>
  ${record.finish_time ? `<img alt=${record.task.prompt} src='/api/task/${record.id}/small'/>` : ''}
</div>
`;

export default {
  index: (lasts: QueueTaskRecord[], actives: QueueTaskRecord[], nexts: QueueTaskRecord[], depth: number) =>
    html(`
  ${lasts.map(taskline).join('\n')}
  <pre>${actives.length.toString().padStart(6)} tasks active.</pre>
  ${actives.map(taskline).join('\n')}
  <pre>${depth.toString().padStart(6)} tasks in queue.</pre>
  ${nexts.map(taskline).join('\n')}
`),
  task: (record: QueueTaskRecord) =>
    html(`
    <img alt=${record.task.prompt} src='/api/task/${record.id}/result'/>
    ${taskline(record)}
  `),
  tasks: () => html(`
    <pre>not implemented</pre>
  `)
};
