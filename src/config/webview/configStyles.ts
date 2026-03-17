/**
 * configStyles.ts
 * CSS for the project configuration panel webview.
 */

export function getConfigStyles(): string {
    return `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;background:#1e1e1e;color:#cccccc;
        display:flex;flex-direction:column;height:100vh;overflow:hidden;
    }
    .scroll-area{flex:1;overflow-y:auto;min-height:0;padding:24px}
    .inner{max-width:620px}

    /* ── Header ── */
    .header{display:flex;align-items:center;gap:10px;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08)}
    .header-title{font-size:15px;font-weight:600;color:#cccccc}
    .header-sub{font-size:11px;color:rgba(204,204,204,.4);margin-top:2px}

    /* ── Sections ── */
    .section{margin-bottom:28px}
    .section-title{
        font-size:11px;font-weight:700;text-transform:uppercase;
        letter-spacing:.08em;color:rgba(204,204,204,.5);margin-bottom:12px;
    }

    /* ── Inputs ── */
    .field{margin-bottom:10px}
    label{display:block;font-size:11px;color:rgba(204,204,204,.6);margin-bottom:4px}
    .input{
        width:100%;background:#3c3c3c;border:1px solid rgba(255,255,255,.1);
        color:#cccccc;font-family:inherit;font-size:12px;
        padding:6px 10px;outline:none;transition:border-color .1s;
    }
    .input:focus{border-color:rgba(204,204,204,.4)}
    .input::placeholder{color:rgba(204,204,204,.2)}

    /* ── Auth type buttons ── */
    .auth-types{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
    .auth-type-btn{
        background:#2d2d30;border:1px solid rgba(255,255,255,.1);
        color:rgba(204,204,204,.6);font-size:11px;font-family:inherit;
        padding:5px 14px;cursor:pointer;transition:all .1s;
    }
    .auth-type-btn:hover{border-color:rgba(255,255,255,.25);color:#cccccc}
    .auth-type-btn.active{background:#10b98120;border-color:#10b981;color:#10b981}
    .auth-fields{display:none}
    .auth-fields.visible{display:block}

    /* ── Headers list ── */
    .headers-list{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
    .header-row{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center}
    .remove-btn{
        background:transparent;border:none;cursor:pointer;
        color:rgba(204,204,204,.3);padding:4px;display:flex;
        align-items:center;transition:color .1s;flex-shrink:0;
    }
    .remove-btn:hover{color:#f43f5e}
    .add-btn{
        background:transparent;border:1px dashed rgba(255,255,255,.15);
        color:rgba(204,204,204,.4);font-size:11px;font-family:inherit;
        padding:6px 12px;cursor:pointer;transition:all .1s;width:100%;text-align:left;
    }
    .add-btn:hover{border-color:rgba(255,255,255,.3);color:rgba(204,204,204,.7)}

    /* ── Footer ── */
    .footer{
        flex-shrink:0;padding:14px 24px;
        border-top:1px solid rgba(255,255,255,.08);background:#1e1e1e;
        display:flex;align-items:center;gap:12px;
    }
    .save-btn{
        display:inline-flex;align-items:center;gap:7px;
        font-family:inherit;font-size:12px;font-weight:600;
        padding:7px 18px;background:#10b981;color:#1e1e1e;
        border:none;cursor:pointer;transition:opacity .1s;
    }
    .save-btn:hover{opacity:.85}
    .saved-msg{font-size:11px;color:#10b981;opacity:0;transition:opacity .3s}
    .saved-msg.visible{opacity:1}
    .divider{height:1px;background:rgba(255,255,255,.06);margin:4px 0 20px}
    `
}