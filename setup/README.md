# My Agent Setup

My personal setup: the third-party skills I install and my global agent instructions. The skills in this repo don't need any of it.

## Third-Party Skills

```bash
bunx skills add vercel-labs/skills -s find-skills -g
bunx skills add anthropics/skills -s docx -s pdf -s pptx -s xlsx -s frontend-design -s skill-creator -g
bunx skills add vercel-labs/agent-skills -s vercel-composition-patterns -s vercel-react-best-practices -s vercel-react-view-transitions -s web-design-guidelines -g
bunx skills add vercel/ai -s ai-sdk -g
bunx skills add vercel/ai-elements -s ai-elements -g
bunx skills add vercel/streamdown -s streamdown -g
bunx skills add vercel/workflow -s workflow -s workflow-init -g
bunx skills add better-auth/skills -g
bunx skills add stripe/ai -s stripe-best-practices -g
bunx skills add shadcn/ui -s shadcn -g
bunx skills add resend/react-email -s react-email -g
bunx skills add ejekanshjain/skills -g
```

## Global Agent Instructions

My global instructions live in the [global-instructions](../skills/global-instructions) skill. Ask any agent to "set up my global agent instructions" and it writes them for Claude Code, Codex, Gemini CLI and OpenCode, with backups of existing files.
