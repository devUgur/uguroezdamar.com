import { officeOrigin } from "@/src/adapters/office";
import { WorkBoard, listWorkTasks, workLiveOrigin } from "@/src/features/work";

export default async function WorkPage() {
  const result = await listWorkTasks();
  return <WorkBoard tasks={result.tasks} error={result.error} liveOrigin={workLiveOrigin()} officeOrigin={officeOrigin()} />;
}
