import { useState } from "react";

interface Props {
  token: string;
  isNew?: boolean;
}

export default function TokenDisplay({ token, isNew }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isNew) {
    return (
      <div className="token-display token-new">
        <p className="token-warning">Save this token now — it won't be shown again.</p>
        <div className="token-value">
          <code>{token}</code>
          <button className="btn-small" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  return <code className="token-masked">{token}</code>;
}
