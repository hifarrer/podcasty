import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PassThrough } from "node:stream";

ffmpeg.setFfmpegPath(ffmpegPath || "");

export async function wavToMp3Loudnorm(inputBuffer: Buffer, inputFormat: "wav" | "mp3" = "wav"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];
    outputStream.on("data", (c) => chunks.push(c));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    ffmpeg(inputStream)
      .inputFormat(inputFormat)
      .audioChannels(1)
      .audioFrequency(44100)
      .audioFilters(["loudnorm=I=-16:TP=-1:LRA=11"])
      .audioCodec("libmp3lame")
      .audioBitrate("160k")
      .format("mp3")
      .on("error", reject)
      .pipe(outputStream);

    inputStream.end(inputBuffer);
  });
}


