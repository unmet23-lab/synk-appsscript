import { findCodexMailTarget } from "./office-mail-model.mjs";

export function quoteOutcomeLabel(task) {
  if (!task || typeof task !== "object" || !task.quoteSource || typeof task.quoteSource !== "object" || Array.isArray(task.quoteSource) || task.status !== "completed") {
    return "";
  }
  if (task.quoteOutcome === "held") return "보류";
  if (task.quoteOutcome === "draft") return "초안 작성 완료";
  return "";
}

export function createQuoteHandoffView(doc, emit, focusChild) {
  const STATUS = {
    queued: "대기", running: "진행 중", paused: "일시정지",
    completed: "완료", failed: "실패", interrupted: "중단",
  };
  const element = doc.createElement("div");
  element.hidden = true;
  let lastKey = "";

  function update(task, tasks, mail, mailUI) {
    const list = mail && task && Array.isArray(tasks) ? tasks : [];
    const handoffs = mail && Array.isArray(task?.handoffs)
      ? task.handoffs.filter(Boolean).map((h) => {
          const id = h.id || "";
          const child = id ? list.find((t) => t?.id === id) : null;
          return {
            id,
            canFocus: Boolean(child),
            label: [h.subject || id || "견적 업무", quoteOutcomeLabel(child) || (child?.reason === "CANCELLED" && ["failed", "interrupted"].includes(child?.status || h.status) ? "취소됨" : (child?.status || h.status) === "interrupted" ? "중단됨" : STATUS[child?.status || h.status])].filter(Boolean).join(" · "),
          };
        })
      : [];

    const raw = mail && task?.quoteSource && typeof task.quoteSource === "object" ? task.quoteSource : null;
    const target = raw ? findCodexMailTarget(list, raw.parentId, raw.itemId) : null;
    const canOpen = Boolean(target);
    const itemKey = canOpen ? JSON.stringify([target.taskId, target.itemId]) : "";
    const note = canOpen && typeof mailUI?.sourceItemNotes?.[itemKey] === "string" ? mailUI.sourceItemNotes[itemKey] : "";
    const source = raw ? {
      parentId: raw.parentId || "", itemId: raw.itemId || "",
      lines: [
        "메일 담당 → 견적 담당",
        raw.subject && `제목: ${raw.subject}`,
        raw.from && `보낸이: ${raw.from}`,
        raw.date && `날짜: ${raw.date}`,
        raw.evidence && `근거: ${raw.evidence}`,
      ].filter(Boolean),
      canOpen, note,
    } : null;

    const nextKey = handoffs.length || source ? JSON.stringify({ handoffs, source }) : "";
    if (nextKey === lastKey) return;
    lastKey = nextKey;
    if (element.replaceChildren) element.replaceChildren(); else element.textContent = "";
    element.hidden = !nextKey;
    if (!nextKey) return;

    if (handoffs.length) {
      const parentBox = doc.createElement("div");
      parentBox.className = "off-task-actions";
      parentBox.setAttribute("data-office-quote-parent", "");
      for (const item of handoffs) {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-office-quote-link", item.id);
        btn.className = "off-task-copy";
        btn.disabled = !item.canFocus;
        btn.textContent = item.label;
        if (item.canFocus) btn.addEventListener("click", () => focusChild?.(item.id));
        parentBox.appendChild(btn);
      }
      element.appendChild(parentBox);
    }

    if (source) {
      const childBox = doc.createElement("div");
      childBox.setAttribute("data-office-quote-child", "");
      for (const text of source.lines) {
        const p = doc.createElement("p");
        p.className = "off-task-note";
        p.textContent = text;
        childBox.appendChild(p);
      }
      if (source.canOpen) {
        const actions = doc.createElement("div");
        actions.className = "off-task-actions";
        const openBtn = doc.createElement("button");
        openBtn.type = "button";
        openBtn.setAttribute("data-office-quote-source", source.itemId);
        openBtn.textContent = "원문 열기";
        openBtn.addEventListener("click", () => emit?.({ act: "task-mail-open", arg: source.parentId, fields: { itemId: source.itemId } }));
        actions.appendChild(openBtn);
        childBox.appendChild(actions);
      }
      if (source.note) {
        const noteEl = doc.createElement("p");
        noteEl.className = "off-task-note";
        noteEl.textContent = source.note;
        childBox.appendChild(noteEl);
      }
      element.appendChild(childBox);
    }
  }

  return { element, update };
}
