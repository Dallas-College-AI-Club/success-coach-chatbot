"use client";
import { citationHref } from "@/lib/constants";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownViewer = ({
  content,
  className,
}: {
  content: string;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "prose prose-li:my-1 prose-p:my-0.5 prose-li:list-item prose-ul:flex prose-ul:flex-col prose-ul:my-1.5 prose-headings:my-0 prose-table:block prose-table:overflow-x-auto",  
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // The model writes prose, and remark-gfm autolinks any bare URL in it.
        // Without this, a hallucinated or spliced address renders as a live
        // link — the same risk the tool-result citation allowlist exists to
        // prevent. Same allowlist, so both paths agree on what is citable;
        // anything else renders as plain text.
        urlTransform={(url) => citationHref(url) ?? ""}
        components={{
          a: (node) =>
            node.href ? (
              <a href={node.href} target="_blank" rel="noopener noreferrer">
                {node.children}
              </a>
            ) : (
              <>{node.children}</>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
