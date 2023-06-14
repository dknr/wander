import { buildPipeline } from "./pipe.ts";
import { QueueTask } from "./queue.ts";

// Deno.mkdir("data/results", {recursive: true});

const { txt2img } = buildPipeline("./models/dreamlike-photoreal-2.0");
// const {txt2img} = buildPipeline("./data/models/analog-diffusion");

const performTask = async (task: QueueTask) => {
  if (task.type !== "txt2img") return;
  const result = txt2img({
    seed: task.seed,
    height: task.height,
    width: task.width,
    prompt: task.prompt,
    negative_prompt: task.negative_prompt,
    guidance_scale: task.guidance_scale,
    num_inference_steps: task.num_inference_steps,
  });

  await fetch(`http://192.168.0.3:21634/api/task/${task.id}/finish`, {
    method: "post",
    headers: { "content-type": "image/jpeg" },
    body: result,
  });
};

const performTasks = async () => {
  while (true) {
    // const task = queue.startNextTask();
    try {
      const taskResponse = await fetch(
        "http://192.168.0.3:21634/api/task/next/start",
      );
      if (taskResponse.ok) {
        const task = await taskResponse.json();
        console.log(
          `performing task: id=${task.id} ${task.width}x${task.height}`,
        );
        await performTask(task);
      } else {
        setTimeout(performTasks, 1000);
        // TODO: subscribe to SSE stream for next task
        return;
      }
    } catch (e) {
      console.log(e);
      setTimeout(performTasks, 5000);
      return;
    }
  }
};

performTasks();
