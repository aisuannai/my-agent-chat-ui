import { useState } from "react";
import { useStreamContext } from "@/providers/Stream";
import { cn } from "@/lib/utils";

interface AskUserQuestion {
  id: string;
  question: string;
  type: "text" | "choice";
  choices?: string[];
  required?: boolean;
  hint?: string;
}

/**
 * 判定 interrupt 是否为 ask_user 结构（后端 src/subagent/dispatcher.py 的
 * ask_user 工具 interrupt 的 value 形态：{ type: "ask_user", questions: [...] }）。
 */
export function isAskUserInterrupt(value: unknown): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || typeof v !== "object") return false;
  const val = (v as { value?: unknown }).value ?? v;
  if (!val || typeof val !== "object") return false;
  const obj = val as Record<string, unknown>;
  return obj.type === "ask_user" && Array.isArray(obj.questions);
}

/**
 * ask_user 中断的收集表单：按后端传来的 questions 动态渲染
 * text → 输入框 / choice → 下拉选择，提交时复用 thread.submit 的
 * resume 通道回传 { answers: { [question_id]: answer } }。
 *
 * 与 agent-inbox 的审批卡片（approve/edit/reject）完全解耦——
 * 这里是"收集信息"，不是"批准动作"。
 */
export function AskUserView({
  interrupt,
}: {
  interrupt: Record<string, any> | Record<string, any>[];
}) {
  const thread = useStreamContext();
  const raw: Record<string, any> = Array.isArray(interrupt)
    ? interrupt[0]
    : interrupt;
  const value: Record<string, any> = raw?.value ?? raw;
  const questions: AskUserQuestion[] = value?.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const missingRequired = questions
    .filter((q) => q.required !== false && !answers[q.id]?.trim())
    .map((q) => q.id);

  const submit = (cancel: boolean) => {
    setLoading(true);
    thread.submit(
      {},
      {
        command: {
          resume: cancel ? { answers: null } : { answers },
        },
      },
    );
  };

  if (!questions.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h3 className="font-medium text-gray-900">需要你补充以下信息</h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="mb-1 block text-sm text-gray-700">
              {q.question}
              {q.required !== false && (
                <span className="ml-1 text-red-500">*</span>
              )}
            </label>
            {q.type === "choice" ? (
              <select
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
              >
                <option value="">请选择…</option>
                {q.choices?.map((c) => (
                  <option
                    key={c}
                    value={c}
                  >
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder={q.hint ?? "请输入…"}
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={() => submit(false)}
            disabled={missingRequired.length > 0 || loading}
            className={cn(
              "rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {loading ? "提交中…" : "提交"}
          </button>
          <button
            onClick={() => submit(true)}
            disabled={loading}
            className="rounded-md px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
