import { test, expect } from "../fixtures/criticalTest";

test("kanban CRUD + bulk task flows @critical", async ({ gateway }) => {
  const createOne = await gateway.request<{ task: { id: string } }>("/tasks/create", {
    method: "POST",
    body: JSON.stringify({ title: "E2E Task A", status: "inbox", priority: "normal" })
  });
  expect(createOne.status).toBe(200);

  const createTwo = await gateway.request<{ task: { id: string } }>("/tasks/create", {
    method: "POST",
    body: JSON.stringify({ title: "E2E Task B", status: "assigned", priority: "high" })
  });
  expect(createTwo.status).toBe(200);

  const taskA = createOne.body.task.id;
  const taskB = createTwo.body.task.id;

  const move = await gateway.request(`/tasks/${encodeURIComponent(taskA)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "in_progress" })
  });
  expect(move.status).toBe(200);

  const archive = await gateway.request(`/tasks/${encodeURIComponent(taskB)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done" })
  });
  expect(archive.status).toBe(200);

  const list = await gateway.request<{ tasks: Array<{ id: string; status: string }> }>("/tasks");
  const byId = new Map(list.body.tasks.map((task) => [task.id, task.status]));
  expect(byId.get(taskA)).toBe("in_progress");
  expect(byId.get(taskB)).toBe("done");

  const remove = await gateway.request(`/tasks/${encodeURIComponent(taskA)}`, { method: "DELETE" });
  expect(remove.status).toBe(200);

  const afterDelete = await gateway.request<{ tasks: Array<{ id: string }> }>("/tasks");
  expect(afterDelete.body.tasks.some((task) => task.id === taskA)).toBeFalsy();
});

