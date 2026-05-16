import { describe, test, expect } from "bun:test";

import { EditorState, EditorSelection, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import {
  wrapSelection,
  togglePrefix,
  insertLink,
  toggleCode,
  toggleMath,
  HEADING_GROUP,
  LIST_GROUP,
} from "./editor-actions";

// ─── Mock ────────────────────────────────────────────────────────────────────

function mockView(docStr: string, from: number, to = from): EditorView {
  let state = EditorState.create({
    doc: docStr,
    selection: EditorSelection.range(from, to),
  });
  return {
    get state() {
      return state;
    },
    dispatch(...specs: TransactionSpec[]) {
      for (const spec of specs) {
        state = state.update(spec).state;
      }
    },
    focus() {
      return;
    },
  } as unknown as EditorView;
}

const docOf = (v: EditorView) => v.state.doc.toString();
const selOf = (v: EditorView) => {
  const { from, to } = v.state.selection.main;
  return { from, to };
};

// ─── wrapSelection ───────────────────────────────────────────────────────────

describe("wrapSelection", () => {
  test("empty cursor inserts marker pair and places cursor inside", () => {
    const v = mockView("into", 2);
    wrapSelection(v, "*");
    expect(docOf(v)).toBe("in**to");
    expect(selOf(v)).toEqual({ from: 3, to: 3 });
  });

  test("selection wraps text in markers", () => {
    const v = mockView("hello", 1, 4);
    wrapSelection(v, "*");
    expect(docOf(v)).toBe("h*ell*o");
    expect(selOf(v)).toEqual({ from: 2, to: 5 });
  });

  test("selection spanning full wrapped text strips markers", () => {
    const v = mockView("*bold*", 0, 6);
    wrapSelection(v, "*");
    expect(docOf(v)).toBe("bold");
    expect(selOf(v)).toEqual({ from: 0, to: 4 });
  });

  test("cursor inside wrapped text strips markers", () => {
    const v = mockView("*bold*", 3);
    wrapSelection(v, "*");
    expect(docOf(v)).toBe("bold");
    expect(selOf(v)).toEqual({ from: 2, to: 2 });
  });

  test("asymmetric wrap applies to selected text", () => {
    const v = mockView("hello", 0, 5);
    wrapSelection(v, "#strike[", "]");
    expect(docOf(v)).toBe("#strike[hello]");
    expect(selOf(v)).toEqual({ from: 8, to: 13 });
  });

  test("cursor inside asymmetric pair strips markers", () => {
    const v = mockView("#strike[hello]", 10);
    wrapSelection(v, "#strike[", "]");
    expect(docOf(v)).toBe("hello");
  });
});

// ─── togglePrefix ────────────────────────────────────────────────────────────

describe("togglePrefix", () => {
  test("adds prefix to plain line and shifts cursor", () => {
    const v = mockView("hello", 3);
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe("- hello");
    expect(selOf(v)).toEqual({ from: 5, to: 5 });
  });

  test("removes prefix from prefixed line and shifts cursor", () => {
    const v = mockView("- hello", 5);
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe("hello");
    expect(selOf(v)).toEqual({ from: 3, to: 3 });
  });

  test("indent cursor on empty line when toggling list", () => {
    const v = mockView("", 0);
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe("- ");
    expect(selOf(v)).toEqual({ from: 2, to: 2 });
  });

  test("adds prefix to all lines when none are prefixed", () => {
    const v = mockView("foo\nbar", 0, 7);
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe("- foo\n- bar");
  });

  test("removes prefix from all lines when all are prefixed", () => {
    const v = mockView("- foo\n- bar", 0, 11);
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe("foo\nbar");
  });

  test("replaces sibling list prefix with target", () => {
    const v = mockView("- item", 4);
    togglePrefix(v, "+ ", LIST_GROUP);
    expect(docOf(v)).toBe("+ item");
  });

  test("replaces sibling heading prefix with deeper heading", () => {
    const v = mockView("= Title", 4);
    togglePrefix(v, "== ", HEADING_GROUP);
    expect(docOf(v)).toBe("== Title");
  });
});

// ─── insertLink ──────────────────────────────────────────────────────────────

describe("insertLink", () => {
  test("empty selection inserts template with cursor in URL slot", () => {
    const v = mockView("", 0);
    insertLink(v);
    expect(docOf(v)).toBe('#link("https://")[]');
    // cursor lands after '#link("https://' (7 + 8 = 15)
    expect(selOf(v)).toEqual({ from: 15, to: 15 });
  });

  test("selected text becomes link label, cursor placed in URL slot", () => {
    const v = mockView("example", 0, 7);
    insertLink(v);
    expect(docOf(v)).toBe('#link("https://")[example]');
    expect(selOf(v)).toEqual({ from: 15, to: 15 });
  });
});

// ─── toggleCode ──────────────────────────────────────────────────────────────

describe("toggleCode", () => {
  test("empty cursor inserts inline code pair", () => {
    const v = mockView("", 0);
    toggleCode(v);
    expect(docOf(v)).toBe("``");
    expect(selOf(v)).toEqual({ from: 1, to: 1 });
  });

  test("selection wraps text in inline code", () => {
    const v = mockView("hello", 0, 5);
    toggleCode(v);
    expect(docOf(v)).toBe("`hello`");
    expect(selOf(v)).toEqual({ from: 1, to: 6 });
  });

  test("inline code selection upgrades to code block", () => {
    const v = mockView("`hello`", 0, 7);
    toggleCode(v);
    expect(docOf(v)).toBe("```\nhello\n```");
    expect(selOf(v)).toEqual({ from: 4, to: 9 });
  });

  test("cursor inside inline code upgrades to code block", () => {
    const v = mockView("`hello`", 3);
    toggleCode(v);
    expect(docOf(v)).toBe("```\nhello\n```");
    expect(selOf(v)).toEqual({ from: 6, to: 6 });
  });

  test("code block selection strips to plain text", () => {
    const v = mockView("```\nhello\n```", 0, 13);
    toggleCode(v);
    expect(docOf(v)).toBe("hello");
    expect(selOf(v)).toEqual({ from: 0, to: 5 });
  });

  test("cursor inside code block strips markers", () => {
    const v = mockView("```\nhello\n```", 6);
    toggleCode(v);
    expect(docOf(v)).toBe("hello");
    expect(selOf(v)).toEqual({ from: 2, to: 2 });
  });
});

// ─── toggleMath ──────────────────────────────────────────────────────────────

describe("toggleMath", () => {
  test("empty cursor inserts inline math pair", () => {
    const v = mockView("", 0);
    toggleMath(v);
    expect(docOf(v)).toBe("$$");
    expect(selOf(v)).toEqual({ from: 1, to: 1 });
  });

  test("selection wraps text in inline math", () => {
    const v = mockView("x", 0, 1);
    toggleMath(v);
    expect(docOf(v)).toBe("$x$");
    expect(selOf(v)).toEqual({ from: 1, to: 2 });
  });

  test("inline math selection upgrades to display math", () => {
    const v = mockView("$x$", 0, 3);
    toggleMath(v);
    expect(docOf(v)).toBe("$ x $");
    expect(selOf(v)).toEqual({ from: 2, to: 3 });
  });

  test("display math selection strips to plain text", () => {
    const v = mockView("$ x $", 0, 5);
    toggleMath(v);
    expect(docOf(v)).toBe("x");
    expect(selOf(v)).toEqual({ from: 0, to: 1 });
  });

  test("cursor inside inline math upgrades to display math", () => {
    const v = mockView("$x$", 1);
    toggleMath(v);
    expect(docOf(v)).toBe("$ x $");
    expect(selOf(v)).toEqual({ from: 2, to: 2 });
  });

  test("cursor inside display math strips markers", () => {
    // "$ x $" - cursor on 'x' at position 2
    const v = mockView("$ x $", 2);
    toggleMath(v);
    expect(docOf(v)).toBe("x");
    expect(selOf(v)).toEqual({ from: 0, to: 0 });
  });
});
