import {
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile,
    setIcon
} from "obsidian";
import { Admonition } from "src/@types";
import ObsidianAdmonition from "src/main";

abstract class AdmonitionOrCalloutSuggester extends EditorSuggest<[string, Admonition]> {
    constructor(public plugin: ObsidianAdmonition) {
        super(plugin.app);
    }
    getSuggestions(ctx: EditorSuggestContext) {
        if (!ctx.query?.length) return Object.entries(this.plugin.admonitions);

        return Array.from(Object.entries(this.plugin.admonitions).filter((p) =>
            p[0].toLowerCase().contains(ctx.query.toLowerCase()))
        );
    }
    renderSuggestion([text, item]: [text: string, item: Admonition], el: HTMLElement) {
        el.createSpan({ text });
        const iconDiv = createDiv("suggestion-flair admonition-suggester-icon");
        iconDiv
            .appendChild(
                this.plugin.iconManager.getIconNode(item.icon) ?? createDiv()
            )
            .setAttribute("color", `rgb(${item.color})`);

        el.prepend(iconDiv);
        
    }
    onTrigger(
        cursor: EditorPosition,
        editor: Editor
    ): EditorSuggestTriggerInfo {
        const line = editor.getLine(cursor.line);
        const match = this.testAndReturnQuery(line, cursor);
        if (!match) return null;
        const [_, query] = match;

        if (
            Object.keys(this.plugin.admonitions).find(
                (p) => p.toLowerCase() == query.toLowerCase()
            )
        ) {
            return null;
        }

        const matchData = {
            end: cursor,
            start: {
                ch: match.index + this.offset,
                line: cursor.line
            },
            query
        };
        return matchData;
    }
    abstract offset: number;
    abstract selectSuggestion(
        value: [string, Admonition],
        evt: MouseEvent | KeyboardEvent
    ): void;
    abstract testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null;
}

export class CalloutSuggest extends AdmonitionOrCalloutSuggester {
    offset = 4;
    selectSuggestion([text]: [text: string, item: Admonition], evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;

        const line = this.context.editor
            .getLine(this.context.end.line)
            .slice(this.context.end.ch);
        const [_, exists] = line.match(/^(\] ?)/) ?? [];

        this.context.editor.replaceRange(
            `${text}] `,
            this.context.start,
            {
                ...this.context.end,
                ch:
                    this.context.start.ch +
                    this.context.query.length +
                    (exists?.length ?? 0)
            },
            "admonitions"
        );

        this.context.editor.setCursor(
            this.context.start.line,
            this.context.start.ch + text.length + 2
        );

        this.close();
    }
    testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null {
        if (/> ?\[!\w+\]/.test(line.slice(0, cursor.ch))) return null;
        if (!/> ?\[!\w*/.test(line)) return null;
        return line.match(/> ?\[!(\w*)\]?/);
    }
}
export class AdmonitionSuggest extends AdmonitionOrCalloutSuggester {
    offset = 6;
    selectSuggestion([text]: [text: string, item: Admonition], evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;

        this.context.editor.replaceRange(
            `${text}`,
            this.context.start,
            this.context.end,
            "admonitions"
        );

        this.close();
    }
    testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null {
        if (!/```ad-\w*/.test(line)) return null;
        return line.match(/```ad-(\w*)/);
    }
}
