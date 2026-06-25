import { CanvasEditor } from "@/components/canvas-editor";
import { getCanvasBackgrounds } from "@/lib/backgrounds";

export default async function Home() {
  const backgrounds = await getCanvasBackgrounds();

  return <CanvasEditor backgrounds={backgrounds} />;
}
