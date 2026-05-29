import { describe, test, expect } from "bun:test";

import { EditorState, EditorSelection, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import {
  wrapSelection,
  togglePrefix,
  insertLink,
  insertPageBreak,
  toggleCode,
  toggleMath,
  HEADING_GROUP,
  LIST_GROUP,
} from "./editor-actions";

// ─── Mock ────────────────────────────────────────────────────────────────────

/** Creates a mock EditorView from a marked string. ˅ markers come in pairs:
 * ˅˅ at the same position is a cursor, ˅text˅ is a selection range. Multiple
 * pairs create multiple cursors/selections; the last pair is the main selection. */
function mockView(marked: string): EditorView {
  const ranges = [];
  let doc = "";
  let open: number | null = null;

  for (const ch of marked) {
    if (ch === "˅") {
      if (open === null) {
        open = doc.length;
      } else {
        ranges.push(EditorSelection.range(open, doc.length));
        open = null;
      }
    } else {
      doc += ch;
    }
  }

  if (ranges.length === 0) {
    ranges.push(EditorSelection.cursor(0));
  }

  let state = EditorState.create({
    doc,
    selection: EditorSelection.create(ranges, ranges.length - 1),
    extensions: [EditorState.allowMultipleSelections.of(true)],
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
  } as EditorView;
}

const docOf = (v: EditorView) => v.state.doc.toString();

/** Returns the current doc with ˅ markers reinserted at all selection positions,
 * mirroring the input convention of {@link mockView}. Cursors appear as ˅˅,
 * selections as ˅text˅. */
function markDoc(v: EditorView): string {
  const doc = v.state.doc.toString();
  const marks: number[] = [];
  for (const range of v.state.selection.ranges) {
    marks.push(range.from, range.to);
  }
  marks.sort((a, b) => a - b);

  let result = "";
  let last = 0;
  for (const pos of marks) {
    result += doc.slice(last, pos) + "˅";
    last = pos;
  }
  return result + doc.slice(last);
}

// ─── wrapSelection ───────────────────────────────────────────────────────────

describe("wrapSelection", () => {
  test("empty cursor inserts marker pair and places cursor inside", () => {
    const v = mockView("in˅˅to");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("in*˅˅*to");
  });

  test("selection wraps text in markers", () => {
    const v = mockView("h˅ell˅o");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("h*˅ell˅*o");
  });

  test("selection spanning full wrapped text strips markers", () => {
    const v = mockView("˅*bold*˅");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("˅bold˅");
  });

  test("cursor inside wrapped text strips markers", () => {
    const v = mockView("*bo˅˅ld*");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("bo˅˅ld");
  });

  test("asymmetric wrap applies to selected text", () => {
    const v = mockView("˅hello˅");
    wrapSelection(v, "#strike[", "]");
    expect(markDoc(v)).toBe("#strike[˅hello˅]");
  });

  test("cursor inside asymmetric pair strips markers", () => {
    const v = mockView("#strike[hel˅˅lo]");
    wrapSelection(v, "#strike[", "]");
    expect(docOf(v)).toBe("hello");
  });
});

// ─── togglePrefix ────────────────────────────────────────────────────────────

describe("togglePrefix", () => {
  test("adds prefix to plain line and shifts cursor", () => {
    const v = mockView("hel˅˅lo");
    togglePrefix(v, "- ", LIST_GROUP);
    expect(markDoc(v)).toBe("- hel˅˅lo");
  });

  test("removes prefix from prefixed line and shifts cursor", () => {
    const v = mockView("- hel˅˅lo");
    togglePrefix(v, "- ", LIST_GROUP);
    expect(markDoc(v)).toBe("hel˅˅lo");
  });

  test("indent cursor on empty line when toggling list", () => {
    const v = mockView("˅˅");
    togglePrefix(v, "- ", LIST_GROUP);
    expect(markDoc(v)).toBe("- ˅˅");
  });

  test("adds prefix to all lines when none are prefixed", () => {
    const v = mockView(
      `˅foo
bar˅`
    );
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe(
      `- foo
- bar`
    );
  });

  test("removes prefix from all lines when all are prefixed", () => {
    const v = mockView(
      `˅- foo
- bar˅`
    );
    togglePrefix(v, "- ", LIST_GROUP);
    expect(docOf(v)).toBe(
      `foo
bar`
    );
  });

  test("replaces sibling list prefix with target", () => {
    const v = mockView("- it˅˅em");
    togglePrefix(v, "+ ", LIST_GROUP);
    expect(docOf(v)).toBe("+ item");
  });

  test("replaces sibling heading prefix with deeper heading", () => {
    const v = mockView("= Ti˅˅tle");
    togglePrefix(v, "== ", HEADING_GROUP);
    expect(docOf(v)).toBe("== Title");
  });
});

// ─── insertLink ──────────────────────────────────────────────────────────────

describe("insertLink", () => {
  test("empty selection inserts template with cursor in URL slot", () => {
    const v = mockView("˅˅");
    insertLink(v);
    expect(markDoc(v)).toBe('#link("https://˅˅")[]');
  });

  test("selected text becomes link label, cursor placed in URL slot", () => {
    const v = mockView("˅example˅");
    insertLink(v);
    expect(markDoc(v)).toBe('#link("https://˅˅")[example]');
  });
});

// ─── insertPageBreak ─────────────────────────────────────────────────────────

describe("insertPageBreak", () => {
  test("inserts pagebreak at cursor with cursor after the call", () => {
    const v = mockView("˅˅");
    insertPageBreak(v);
    expect(markDoc(v)).toBe("#pagebreak()˅˅");
  });
});

// ─── toggleCode ──────────────────────────────────────────────────────────────

describe("toggleCode", () => {
  test("empty cursor inserts inline code pair", () => {
    const v = mockView("˅˅");
    toggleCode(v);
    expect(markDoc(v)).toBe("`˅˅`");
  });

  test("selection wraps text in inline code", () => {
    const v = mockView("˅hello˅");
    toggleCode(v);
    expect(markDoc(v)).toBe("`˅hello˅`");
  });

  test("inline code selection upgrades to code block", () => {
    const v = mockView("˅`hello`˅");
    toggleCode(v);
    expect(markDoc(v)).toBe(
      `\`\`\`
˅hello˅
\`\`\``
    );
  });

  test("cursor inside inline code upgrades to code block", () => {
    const v = mockView("`he˅˅llo`");
    toggleCode(v);
    expect(markDoc(v)).toBe(
      `\`\`\`
he˅˅llo
\`\`\``
    );
  });

  test("code block selection strips to plain text", () => {
    const v = mockView(
      `˅\`\`\`
hello
\`\`\`˅`
    );
    toggleCode(v);
    expect(markDoc(v)).toBe("˅hello˅");
  });

  test("cursor inside code block strips markers", () => {
    const v = mockView(
      `\`\`\`
he˅˅llo
\`\`\``
    );
    toggleCode(v);
    expect(markDoc(v)).toBe("he˅˅llo");
  });
});

// ─── multi-cursor / multi-selection ─────────────────────────────────────────

describe("multi-cursor / multi-selection", () => {
  test("wrapSelection: two cursors each get their own marker pair", () => {
    const v = mockView("a˅˅b and c˅˅d");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("a*˅˅*b and c*˅˅*d");
  });

  test("wrapSelection: two selections both get wrapped", () => {
    const v = mockView("˅foo˅ and ˅bar˅");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("*˅foo˅* and *˅bar˅*");
  });

  test("wrapSelection: wrapped selection strips while plain selection wraps", () => {
    const v = mockView("˅*old*˅ and ˅new˅");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("˅old˅ and *˅new˅*");
  });

  test("wrapSelection: selection wraps and cursor inserts pair in same dispatch", () => {
    const v = mockView("˅hello˅ world˅˅");
    wrapSelection(v, "*");
    expect(markDoc(v)).toBe("*˅hello˅* world*˅˅*");
  });

  test("togglePrefix: two cursors on separate lines both get the prefix", () => {
    const v = mockView(
      `˅˅foo
˅˅bar`
    );
    togglePrefix(v, "- ", LIST_GROUP);
    expect(markDoc(v)).toBe(
      `- ˅˅foo
- ˅˅bar`
    );
  });

  test("togglePrefix: removing on one line and adding on another are independent", () => {
    const v = mockView(
      `- fo˅˅o
ba˅˅r`
    );
    togglePrefix(v, "- ", LIST_GROUP);
    expect(markDoc(v)).toBe(
      `fo˅˅o
- ba˅˅r`
    );
  });

  test("toggleCode: two cursors each get their own inline code pair", () => {
    const v = mockView("a˅˅b and c˅˅d");
    toggleCode(v);
    expect(markDoc(v)).toBe("a`˅˅`b and c`˅˅`d");
  });

  test("toggleMath: two cursors each get their own inline math pair", () => {
    const v = mockView("a˅˅b and c˅˅d");
    toggleMath(v);
    expect(markDoc(v)).toBe("a$˅˅$b and c$˅˅$d");
  });
});

// ─── toggleMath ──────────────────────────────────────────────────────────────

describe("toggleMath", () => {
  test("empty cursor inserts inline math pair", () => {
    const v = mockView("˅˅");
    toggleMath(v);
    expect(markDoc(v)).toBe("$˅˅$");
  });

  test("selection wraps text in inline math", () => {
    const v = mockView("˅x˅");
    toggleMath(v);
    expect(markDoc(v)).toBe("$˅x˅$");
  });

  test("inline math selection upgrades to display math", () => {
    const v = mockView("˅$x$˅");
    toggleMath(v);
    expect(markDoc(v)).toBe("$ ˅x˅ $");
  });

  test("display math selection strips to plain text", () => {
    const v = mockView("˅$ x $˅");
    toggleMath(v);
    expect(markDoc(v)).toBe("˅x˅");
  });

  test("cursor inside inline math upgrades to display math", () => {
    const v = mockView("$˅˅x$");
    toggleMath(v);
    expect(markDoc(v)).toBe("$ ˅˅x $");
  });

  test("cursor inside display math strips markers", () => {
    const v = mockView("$ ˅˅x $");
    toggleMath(v);
    expect(markDoc(v)).toBe("˅˅x");
  });
});
