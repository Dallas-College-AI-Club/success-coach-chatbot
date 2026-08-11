"use client";
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
        "prose prose-li:my-1 prose-p:my-0.5 prose-li:list-item prose-ul:flex prose-ul:flex-col prose-ul:my-1.5 prose-headings:my-0 overflow-x-auto",  
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (node) => (
            <a href={node.href} target="_blank" rel="noopener noreferrer">
              {node.children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
