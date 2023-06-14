import {
  NamedArgument,
  PyObject,
  python,
  PythonConvertible,
} from "https://deno.land/x/python@0.2.4/mod.ts";

const io = python.import("io");
const torch = python.import("torch");
const diffusers = python.import("diffusers");
const { AttnProcessor2_0 } = python.import("diffusers.models.cross_attention");

// const run = Math.floor(new Date().getTime() / 1000);

// const outdir = `results/result-${run}`;
// Deno.mkdirSync(outdir, {recursive: true});

// console.log({torch, diffusers, AttnProcessor2_0});

type Txt2ImgParams = {
  prompt: string;
  negative_prompt: string;
  seed: number;
  height: number;
  width: number;
  num_inference_steps: number;
  guidance_scale: number;
};
const txt2imgDefaults: Txt2ImgParams = {
  prompt: "",
  negative_prompt: "",
  seed: 0,
  height: 768,
  width: 768,
  num_inference_steps: 40,
  guidance_scale: 8,
};

// "./data/models/analog-diffusion"
const defaultModel = "./models/dreamlike-photoreal-2.0";

export const buildPipeline = (model = defaultModel) => {
  const pipe = diffusers.StableDiffusionPipeline.from_pretrained(
    model,
    new NamedArgument("safety_checker", python.None),
    new NamedArgument("torch_dtype", torch.float16),
  ).to("cuda");

  pipe.scheduler = diffusers.EulerAncestralDiscreteScheduler.from_config(
    pipe.scheduler.config,
  );
  pipe.unet.set_attn_processor(AttnProcessor2_0());
  pipe.unet.to(new NamedArgument("memory_format", torch.channels_last));
  // pipe.unet = torch.compile(pipe.unet); // NOTE: enable to gain 10% at the expense of startup time

  type Txt2ImgResult = {
    save: (path: string) => void;
  };

  const txt2img = (params: Partial<Txt2ImgParams>): Uint8Array => {
    const input = { ...txt2imgDefaults, ...params };
    const {
      prompt,
      negative_prompt,
      seed,
      height,
      width,
      num_inference_steps,
      guidance_scale,
    } = input;
    // console.log({seed, height, width});
    const result = pipe(
      prompt,
      new NamedArgument("negative_prompt", negative_prompt),
      new NamedArgument("height", height),
      new NamedArgument("width", width),
      new NamedArgument(
        "generator",
        new torch.Generator(
          new NamedArgument("device", "cuda"),
        ).manual_seed(seed),
      ),
      new NamedArgument("num_inference_steps", num_inference_steps),
      new NamedArgument("guidance_scale", guidance_scale),
    );

    // this is a stupid hack to work-around stupid interop problems
    const tempPath = Deno.makeTempFileSync({
      prefix: "wander",
      suffix: ".jpeg",
    });
    result.images[0].save(tempPath);
    const image = Deno.readFileSync(tempPath);
    Deno.removeSync(tempPath);
    return image;
  };

  return {
    txt2img,
  };
};
