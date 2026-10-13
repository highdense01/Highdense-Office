import { listMyTodos } from "@/server/actions/todos";
import { TodosClient } from "./todos-client";

export default async function TodosPage() {
  const todos = await listMyTodos();
  return <TodosClient todos={todos} />;
}
