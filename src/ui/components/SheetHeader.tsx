import React from "react";

export function SheetHeader(props: {
  title: string;
  ownerLabel: string;
  tokenId: string;
  thumbUrl: string | null;
  showBackButton: boolean;
  onBack: () => void;
  showUnsetButton: boolean;
  onUnset: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {props.thumbUrl ? (
          <img
            src={props.thumbUrl}
            alt="Token thumbnail"
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(0,0,0,0.2)" }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", opacity: 0.4 }} />
        )}

        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {props.title}{" "}
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              ({props.ownerLabel})
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Token: <code style={{ fontSize: 11 }}>{props.tokenId}</code>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {props.showBackButton && (
          <button
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9 }}
            onClick={props.onBack}
          >
            Back to My Sheet
          </button>
        )}
        {props.showUnsetButton && (
          <button
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #999", cursor: "pointer", opacity: 0.9 }}
            onClick={props.onUnset}
          >
            Unset “My Character”
          </button>
        )}
      </div>
    </div>
  );
}
