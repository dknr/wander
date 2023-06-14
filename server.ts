import {Application, Router} from 'https://deno.land/x/oak@v12.5.0/mod.ts';
import pages from './pages.ts';

import * as IM from 'https://deno.land/x/imagemagick_deno@0.0.24/mod.ts';
IM.initialize();

import {openQueue} from './queue.ts';
Deno.mkdirSync('results', {recursive: true});
const queue = openQueue('results');

const app = new Application();
const router = new Router();

router.get('/', (ctx) => {
  const lasts = queue.peekLast(80);
  const nexts = queue.peekNext(20);
  const active = queue.peekActive();
  ctx.response.body = pages.index(lasts, active, nexts, queue.getLength());
});

router.get('/task/:id', (ctx) => {
  const taskId = parseInt(ctx.params.id);
  if (!taskId) {
    ctx.response.status = 400;
    return;
  }

  const task = queue.peek(taskId);
  if (!task) {
    ctx.response.status = 404;
    return;
  }

  ctx.response.body = pages.task(task);
});

router.post('/api/task', async (ctx) => {
  const body = await ctx.request.body({type: 'json'});
  const task = await body.value;
  // TODO: validate input
  const taskId = queue.addTask(task);
  console.log(task.prompt);
  ctx.response.status = 303;
  ctx.response.headers.set('location', `/api/task/${taskId}`);
});

router.get('/api/task/:id', async (ctx) => {
  const {id} = ctx.params;
  const task = queue.getTask(parseInt(id));
  if (task) {
    ctx.response.body = task;
  } else {
    ctx.response.status = 404;
  }
});

router.get('/api/task/:id/result', async (ctx) => {
  const taskId = parseInt(ctx.params.id);
  if (!taskId) {
    ctx.response.status = 400;
    return;
  }

  const task = queue.peek(taskId);
  console.log({task});
  if (!task) {
    ctx.response.status = 404;
    return;
  }

  ctx.response.headers.set('content-type', 'image/jpeg');
  const result = await Deno.readFile(task.result_path + ".jpeg");
  ctx.response.body = result;
});

router.get('/api/task/:id/small', async (ctx) => {
  const taskId = parseInt(ctx.params.id);
  if (!taskId) {
    ctx.response.status = 400;
    return;
  }

  const task = queue.peek(taskId);
  if (!task) {
    ctx.response.status = 404;
    return;
  }
  
  ctx.response.headers.set('content-type', 'image/jpeg');
  const result = await Deno.readFile(task.result_path + "-small.jpeg");
  ctx.response.body = result;
})

router.get('/api/task/next/start', async (ctx) => {
  const task = queue.startNextTask();
  if (task) {
    ctx.response.body = task;
  } else {
    ctx.response.status = 404
  }
});

const smallify = (bytes: Uint8Array) => new Promise<Uint8Array>((resolve) => {
  IM.ImageMagick.read(bytes, async (image) => {
    image.resize(image.width/8,image.height/8);
    image.write(IM.MagickFormat.Jpeg, resolve);
  });
});

router.post('/api/task/:id/finish', async (ctx) => {
  const id = parseInt(ctx.params.id);
  const task = queue.getTask(id);
  if (!task) {
    ctx.response.status = 404;
    return;
  }

  const body = await ctx.request.body({type: 'bytes'});
  const bytes = await body.value;
  
  const path_base = `results/result-${new Date().getTime()}-${task.id.toString().padStart(8, '0')}`;
  const path_json = path_base + '.json';
  const path_jpeg = path_base + '.jpeg';
  const path_small = path_base + '-small.jpeg';

  await Deno.writeFile(path_jpeg, bytes);
  await Deno.writeFile(path_small, await smallify(bytes))
  await Deno.writeTextFile(path_json, JSON.stringify(task.task));
  console.log({id, path_jpeg})
  queue.finishTask(id, path_base);
});

app.use((ctx, next) => {
  const now = new Date();
  console.log([
    `${now.getHours().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3, '0')}`,
    ctx.request.method.padStart(4),
    ctx.request.url.pathname
  ].join(' '));
  return next();
})
app.use(router.allowedMethods());
app.use(router.routes());

app.addEventListener('listen', (e) => {
  console.log(`listening on ${e.hostname || ''}:${e.port}`);
})
app.listen({port: 21634});

