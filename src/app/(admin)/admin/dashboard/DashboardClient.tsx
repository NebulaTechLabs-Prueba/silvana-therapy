'use client';
// @ts-nocheck -- Inherited from original JS dashboard. Will be typed progressively as we wire to DB.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { updateProfile, updateAuthEmail, updateAuthPassword, updateNotepad, updateNickname, updateContactInfo, upsertService, deleteService, toggleServiceActive, upsertInvoice, deleteInvoice, sendInvoiceNotification, upsertBooking, deleteBooking, updateBookingStatus, upsertPaymentMethod, deletePaymentMethod, togglePaymentMethodActive, upsertAdminLink, deleteAdminLink, updateSecurityQuestion, linkPaymentLinkToBooking, unlinkPaymentLinkFromBooking, upsertAvailabilityException, deleteAvailabilityException, updateIntegrations, updateWaTemplates, updateEmailNotifications } from '@/lib/actions/dashboard';
import { getClientTime } from '@/lib/utils/timezone';
import { escapeHtml } from '@/lib/utils/escapeHtml';
import { normalizePhone, buildWaLink } from '@/lib/utils/phone';
import { renderTemplate, WA_TEMPLATE_EVENTS, WA_TEMPLATE_LABELS, WA_TEMPLATE_VARS } from '@/lib/utils/templates';
import { sanitizeName, sanitizePhoneInput, isValidName, isValidEmail } from '@/lib/utils/sanitize';

interface DashboardClientProps {
  userEmail: string;
  userName?: string;
  initialSettings?: any;
  initialServices?: any[];
  initialInvoices?: any[];
  initialBookings?: any[];
  initialPaymentMethods?: any[];
  initialLinks?: any[];
  availablePaymentLinks?: any[];
  initialExceptions?: any[];
  googleStatus?: { connected: boolean; email?: string };
}

/* ═══ LOGO SVG (from Silvana's website) ═══ */
const LOGO_SRC = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4wLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL1RSLzIwMDEvUkVDLVNWRy0yMDAxMDkwNC9EVEQvc3ZnMTAuZHRkIj4NCjwhLS0gQ3JlYXRvcjogQ29yZWxEUkFXIDIwMjEgKDY0LUJpdCkgLS0+DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgd2lkdGg9IjcxLjAyODZtbSIgaGVpZ2h0PSI2OS4yODY1bW0iIHZlcnNpb249IjEuMCIgc2hhcGUtcmVuZGVyaW5nPSJnZW9tZXRyaWNQcmVjaXNpb24iIHRleHQtcmVuZGVyaW5nPSJnZW9tZXRyaWNQcmVjaXNpb24iIGltYWdlLXJlbmRlcmluZz0ib3B0aW1pemVRdWFsaXR5IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCINCnZpZXdCb3g9IjAgMCAzNjYzLjc3IDM1NzMuOTEiDQogeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiDQogeG1sbnM6eG9kbT0iaHR0cDovL3d3dy5jb3JlbC5jb20vY29yZWxkcmF3L29kbS8yMDAzIj4NCiA8ZyBpZD0iQ2FwYV94MDAyMF8xIj4NCiAgPG1ldGFkYXRhIGlkPSJDb3JlbENvcnBJRF8wQ29yZWwtTGF5ZXIiLz4NCiAgPGcgaWQ9Il8xNTE2NTAyNTYzNzI4Ij4NCiAgIDxwYXRoIGZpbGw9IiM0QTdBNEEiIGQ9Ik0xNjQ5LjcxIDMzNy41NmwzMy4wNSAzNS43NmMxLjk5LDIuMzggMi4yNCwzLjEyIDQuNTgsNS40MyAzLjQzLDMuMzggNS44NCw2LjQ5IDkuMTEsOS45OWw5LjExIDEwLjkxYzMwLjc4LDM0LjU1IDYxLjEzLDc0LjA5IDg2LjY0LDExMi42MSAxNS43OSwyMy44NSAzMS40NCw0Ny41NiA0Ni4xMSw3Mi4xNmwxMS4xNyAxOC44NmMxNC4xOSwyNC43NCA0OS43Nyw5MS42OCA1Ny44OCwxMTEuMzVsMTIuNTIgMjYuNmM2LjgzLDEzLjQ1IDEyLjA3LDI2LjkyIDE4LjQ5LDQwLjY1IDE5LjQyLDQxLjUyIDM1LjE2LDg0LjU2IDUxLjksMTI3LjM0bDIxLjA4IDU4LjA4YzI0LjE5LDcyLjg2IDQ1Ljk0LDEzOC4xIDY2LjM1LDIxMi45OCAyMC4yMyw3NC4yMyAzNy43NCwxNDguOTQgNTIuODgsMjI0LjYyIDExLjI4LDU2LjQyIDIwLjMzLDExMy4wNiAyOC4zMywxNzAuMDIgNC44LDM0LjIgMTQuNTYsMTEwLjUxIDE2LjM1LDE0Mi44NyAwLjI5LDUuMiAxLjQ4LDEyLjE0IDEuNzYsMTcuMzQgMC4zMyw1Ljk1IDAuOTIsMTMuMjggMS42LDE4LjQybDcuNTMgMTExLjY1YzAuNjIsMTEuNTIgLTAuMiwyNi44OCAxLjQzLDM3LjY5IDAuOTQsNi4yNCAwLjM0LDEzLjIgMC4zNSwxOS42NiAwLjAxLDYuNDEgMC45NCwxMS40OSAwLjk0LDE5LjA4IC0wLjAxLDE0LjIxIDAuOTEsMjUuMTEgMC45MSwzOS4xMiAwLDI0LjI0IC0yLjEzLDUyLjYyIDMuMTEsNzYuMDUgNy4zLDMyLjcxIDI1LjY5LDUwLjYyIDQ0LjQ2LDc1LjY0IDQwLjU4LDU0LjA2IDc0LjM5LDExMi41MSAxMDMuNzgsMTczLjcyIDEzLjI2LDI3LjYzIDI0LjAxLDU2LjQ1IDMzLjY5LDg1LjUgMTMuODQsNDEuNTIgMjMuOTEsODMuNzEgMzIuNDksMTI2LjczIDQuMzcsMjEuOTIgNi43OCw0Ni40MiA5LjY4LDY5LjQ4IDEuOTUsMTUuNTIgMi4xNiwzMC44NyAyLjk4LDQ2LjE2IDAuMjIsNC4wNSAwLjg5LDQuMzYgMC45NSw5LjA2IDAuMDgsNi42MyAtMC4wMSwxMy40MiAtMC4wNSwyMC4wNyAtMC4wNCw3LjE2IDAuOTEsMTEuMzcgMC45MywxOS4xIDAuMDIsNy41NCAtMC45NSwxMS4zOCAtMC45MiwxOS4xIDAuMDIsNi4zNiAwLjM1LDEzLjc5IDAuMDEsMjAuMDIgLTAuMjIsNC4wNSAtMC44OSw0LjM2IC0wLjk1LDkuMDYgLTAuMDQsMy4xOSAwLjI1LDYuODcgLTAuMDEsMTAgLTcuNjcsOTIuNjggLTE5LjE2LDE2NC4xOSAtNDUuMTIsMjUyLjQgLTE3LjE1LDU4LjI3IC00Mi4wMywxMTQuMzEgLTcwLjY5LDE2Ny43IC0yOS4zNSw1NC43IC02Ni4zMiwxMDQuNzUgLTEwNy4yOCwxNTEuMTIgLTEuODQsMi4wOCAtMi4wMywyLjg4IC00LjA0LDUuMDFsLTkuNTYgMTAuNDZjLTExLjIsMTIuMTIgLTIzLjQzLDIzLjI4IC0zNS4wMywzNS4wMmwtMjAuOTIgMTkuMTJjLTExLjgzLDExLjUgLTQyLjE3LDM1LjA3IC01NC43LDQ0LjQ3IC0xNS40OSwxMS42MiAtMzAuNDgsMjIuMjIgLTQ2LjksMzMuMTcgLTEyLjAxLDguMDEgLTIzLjY5LDE1LjggLTM2LjMxLDIyLjgzIC00LjQ2LDIuNDkgLTguNTksNC44MyAtMTIuNDYsNy41NiAtNy45LDUuNTkgLTE0LjksMTIuNjggLTExLjQ1LDI1Ljk5IDYuMjMsMjQuMDUgMzEuMjgsMTYuNzcgNjAuNTgsMTYuNzdsNTk3LjE3IDBjNDMuODgsMCA4Ny43NSwwIDEzMS42MywwIDQ1LjA0LDAgODcuMzUsLTAuOTIgMTMxLjkzLC0wLjkxIDExLjQyLDAgMTkuOTksLTAuOTEgMzEuODQsLTAuOTEgMTEuMjIsMCAyMi40NCwwIDMzLjY3LDAgMTEuODUsMCAyMC40MywtMC45MSAzMS44NSwtMC45MWwxMzEuOTMgLTAuOTFjMTIuMTIsMCAyMS4zMSwtMC45MSAzMi43NSwtMC45MSAxMzEuODQsMC4wOCAyNjMuNTgsLTEuNjcgMzk1LjgzLC0wLjA0IDUuNTMsMC4wNyA4LjgyLDAuOTcgMTUuNDMsMC45NSAxNC4xMiwtMC4wNSAzNC4zNywwLjI3IDQ3Ljg1LDIuMTkgOC45LDEuMjYgMTkuOTEsMy41MiAzMC4xOCwyLjE1IDguMjEsLTEuMSAxOS4wNSwtNC45MiAyMi4xLC0xMS41NyA1LjA2LC0xMS4wNCAyLjY5LC00Ni4xMiAyLjY5LC02Mi44M2wwIC00NjQuOTRjMCwtMjIuMyAwLjg4LC00MS43NCAwLjkxLC02My41NmwwIC0xLjA0IDAgLTE5OS4yNSAwIC00LjE0IDAgLTI2Mi45M2MtMC42NCwtMTYuODMgLTkuNTQsLTM0LjU1IC0yOS4wOCwtMzUuMDQgLTIzLjkxLC0wLjYxIC0yNy40NywxMi41NiAtMzAuMDYsMzYuNDMgLTEuMDUsOS42MyAtMi41NywxOC44IC00LjAzLDI4LjcyIC0xLjUyLDEwLjMxIC0yLjg2LDE5IC00LjU0LDI5LjEyIC0xLjYyLDkuNjggLTMuMTIsMTkuMDcgLTQuODMsMjcuOTJsLTExLjM0IDU1LjA4Yy0xNC45OSw2NC4wMyAtMjkuMjEsMTE3LjQyIC01My4xMSwxNzkuODEgLTMuMjEsOC4zOCAtNS44LDE1LjQxIC05LjEsMjMuNjZsLTMwLjEgNjkuMDdjLTExLjk1LDIzLjcgLTIwLjkzLDQyLjUgLTMzLjY4LDY1LjQ5IC00LjEzLDcuNDQgLTguMywxMy45IC0xMi40LDIxLjI3bC0yNS4zOCA0MS4wNGMtMjIuNzksMzQuMTggLTY4LjQyLDk3LjM1IC05Ni40OCwxMjcuMzRsLTUxLjg3IDU1LjVjLTExLjM3LDExLjM2IC0xNy4zLDE3LjgxIC0yOS4xMSwyOC4yMWwtMjEuNjEgMjAuMjRjLTMuMzUsMi41NiAtNS4wNCw0LjgyIC04LjcyLDcuNjZsLTI2Ljk3IDIzLjA3Yy0yOS4wNCwyNS4zMiAtNjMuNjgsNDkuNDIgLTk2Ljk4LDY5LjUyIC03Ni4yOCw0Ni4wNiAtMTk5Ljc2LDk2LjEgLTI4Ny44MSwxMTAuNzEgLTE5LjA2LDMuMTYgLTM3LjU1LDYuNTYgLTU3LjE1LDkuMjcgLTE5LjEyLDIuNjUgLTM4LjQ5LDUuNTMgLTU4LjEyLDguMjlsLTU4LjA5IDguMDRjLTUuMTYsMCAtMTIuMDIsMC41NCAtMTcuMiwxLjI5IC0xMy4xMiwxLjkyIC0zNy42MiwxLjM3IC01MC41MywtMS4yIC0zNi4wNSwtNy4xNSAtNDEuODksLTMzLjYyIC00NS41NiwtNjMuNjMgLTMuNDMsLTI4LjEgLTcuNjMsLTc2LjI0IC00LjUxLC0xMDQuMDIgMC45MiwtOC4yIDAuMTMsLTI4NC40NyAwLjEzLC0yOTEuOTMgMCwtOTcuMzYgMCwtMTk0LjcxIDAsLTI5Mi4wNyAwLC05OC4wOSAtMC45MSwtMTkzLjQ0IC0wLjkxLC0yOTEuMTVsMCAtMTQ2MS4yM2MwLC05OC4wNCAwLjkxLC0xOTMuMiAwLjkxLC0yOTEuMTVsMC45MSAtMTA0LjI4YzAsLTIyLjE3IDEuOTMsLTQ5LjY2IDEuODEsLTcwLjk4bDQuNTUgLTY4LjIzYzAuNDcsLTEwLjkzIDIuMzMsLTIzLjQ5IDMuNDgsLTMzLjgyIDExLjcxLC0xMDUuNDQgMzMuNjgsLTE4Ny44NSA3MC42MSwtMjc2LjA0IDEuOTIsLTQuNTggMy43NCwtOC4xMyA1LjYsLTEyLjYgMi4wNiwtNC45NiAzLjkxLC04LjA0IDUuODMsLTEyLjM2IDUuOCwtMTMuMDUgMTQuNjcsLTI4LjQ1IDE4LjIxLC0zNi4zOSAxMy44MiwtMzEuMDYgMC41OSwtMzMuMzQgLTI1LjYxLC0zNi4yNmwtNzMuNiAtMC4xN2MtNS43OSwwLjA3IC0xMC4yMSwwLjk1IC0xNy4yNSwwLjk0bC00MTkuNDUgMGMtNy4xNCwwLjAyIC0xMS4xMSwtMC45MyAtMTcuMjUsLTAuOTRsLTU0LjY0IDAuMDRjLTYuOTQsMC4wNCAtMTAuMTEsLTAuOTYgLTE3LjI3LC0wLjkzbC0zNi40IDAuMDFjLTcuMzcsMC4wMSAtMTEuODksLTAuOTMgLTE4LjE3LC0wLjk0IC0yNS4wMywtMC4wNCAtNDcuNSwtMC44OCAtNzEuOTEsLTAuODhsLTUzLjY4IC0wLjkxYy03LjM3LDAuMDEgLTExLjg5LC0wLjkzIC0xOC4xNiwtMC45NCAtNDguNjUsLTAuMDcgLTk1LjE3LC0yLjcgLTE0My40NCwtMi43bC0yNS44MiAtMC45MWMtNC4xOCwwIC04LjYzLDAuMTUgLTEyLjc3LDAuMDMgLTQuODQsLTAuMTQgLTYuODQsLTAuOTkgLTEyLjY5LC0wLjk1bC0xMDIuODIgLTIuNzJjLTQuMjUsMC4wMiAtOC41LC0wLjAxIC0xMi43NSwwLjAxIC01Ljc4LDAuMDMgLTguMjEsLTAuNjggLTEyLjczLC0wLjkyIC04Ljg4LC0wLjQ3IC0xOC4yNywwLjkzIC0yNi45MiwtMC4zOCAtOC4wOCwtMS4yMiAtMTcuMzYsLTAuMjQgLTI1Ljg5LC0wLjVsLTI1LjQ1IC0wLjkzYy04LjcxLDAuMDQgLTE1LjgxLC0wLjkyIC0yNS40NywtMC45MiAtMTQuNTIsMC4wMSAtMzYuOSwtMS44NyAtNTAuOTUsLTEuODJsLTkwLjExIC0yLjY5Yy01LjI2LC0wLjA2IC02Ljg2LC0wLjk5IC0xMi42OCwtMC45NiAtNC4yNiwwLjAyIC04LjUxLDAuMDEgLTEyLjc3LDAuMDMgLTUuNzgsMC4wMyAtOC4yMSwtMC42OCAtMTIuNzMsLTAuOTIgLTguMzIsLTAuNDUgLTE3Ljk2LDAuMDUgLTI2LjQzLDAuMDMgLTQuOTYsLTAuMDEgLTYuMzUsLTAuNzUgLTEwLjQxLC0wLjk0bC05NC4xOSAwIC0wLjQ3IDAgLTAuNDYgMGMtOS40OSwwLjA1IC0xNS44NiwwLjkyIC0yNS40NiwwLjkxIC0zNC44MSwtMC4wMiAtMTEzLjc0LDcuMzEgLTE0Ni4yMiwxMi4xbC0zNC41OCA1LjQ1Yy0xLjMzLDAuMjIgLTMuMjQsMC41IC01LjQ5LDAuODhsLTQuMzcgMS4wNWMtMC4xNywwLjA2IC0wLjQ4LDAuMjEgLTAuNjIsMC4yNiAtMC4xMywwLjA1IC0wLjQyLDAuMTUgLTAuNiwwLjI4IC0xMy45MSwwIC03OC40NywxNC45IC05MiwxOC4xOSAtNDQuNzEsMTAuODcgLTg2Ljk1LDIyLjA3IC0xMjkuNTQsMzYuOTYgLTMzLjk0LDExLjg2IC02Ni4xNywyNS4zNyAtOTkuMjEsMzkuMDkgLTIyLjQ2LDkuMzMgLTQzLjc5LDIxLjIxIC02NS40MywzMS45MiAtMjguNTIsMTQuMTIgLTYwLjIsMzQuMDQgLTg2LjY0LDUxLjY2IC0yNSwxNi42NyAtNDkuMDQsMzQuNTUgLTcyLjQsNTMuMTUgLTIuNjksMi4xNCAtNC43NSwzLjkzIC03LjQ0LDYuMjFsLTEwLjkxIDkuMWMtMS43NCwxLjQ4IC0yLjIzLDEuNjMgLTQuMDQsMy4yNCAtMTIuNDQsMTEuMDcgLTI1LjA1LDIxLjQgLTM2Ljg2LDMzLjJsLTQwLjg1IDQxLjAzYy0yLjU1LDMuMiAtMy41NCw0LjI3IC02LjQ3LDcuMThsLTE2LjAxIDE4LjU3Yy0xLjI4LDEuNiAtMi4xNCwyLjE4IC0zLjUsMy43OCAtMi4yMSwyLjU5IC0zLjgsNS4wMSAtNi4wMSw3LjYzbC0xOC40NCAyMy40MmMtMjYuMDUsMzQuNzYgLTQ5Ljg5LDcxLjkgLTY5LjI1LDExMC45IC0yMC42OCw0MS42NyAtMzguMDIsODYuNDggLTQ5LjI1LDEzMS44MiAtMjQuNDIsOTguNjYgLTMwLjE1LDE5OS4zIC0xNi4wNCwzMDEuMzggNS43LDQxLjIxIDEyLjMyLDc3LjUgMjIuMDQsMTE1LjM1IDEyLjE4LDQ3LjQxIDMxLjM5LDk3LjE0IDUzLjU3LDE0MS4xNGwyNC4yNSA0NC45YzEuODYsMy4zMyAzLjExLDUuNSA1LDguNjQgMjYuMDYsNDMuMTYgNTQuMjQsODMuNiA4NS45MSwxMjIuNDVsMTkuMTEgMjIuNzRjMS41MiwxLjcxIDEuMzYsMS45IDIuNzksMy41OGwxMi43MyAxNC41NmM5LjQsMTEuMjIgMjAuNTcsMjEuNDQgMzAuMDMsMzIuNzUgMi4xOCwyLjYyIDQuNzgsNC44NiA3LjI0LDcuMzIgOS41OCw5LjU4IDM4LjY3LDQwLjE2IDQ4LjI2LDQ4LjE4bDIxLjggMjAuMDVjMTMuNzEsMTMuOTEgMjkuMzQsMjUuODEgNDMuNjcsMzkuMTIgMS43MiwxLjYgMS45MywxLjUzIDMuNTQsMi44M2w0MS40OCAzNC45NGMyNi4zNSwyMy41MiA3OC40Nyw2MC44NSAxMTAuMDcsODQuNjUgMTguNDIsMTMuODggMzcuOTgsMjYuMTggNTYuNDIsNDAuMDIgMy4wNiwyLjMgNS40NiwzLjggOC42Myw1LjkybDE2Ni42OCAxMTAuODJjMTEuNDIsNy42MSAyMi4xNSwxNC40NyAzMy40OCwyMi4wMiAxMS4zMSw3LjU0IDIyLjQyLDE0LjQ5IDMzLjQ2LDIyLjAybDI4Mi4wOCAxODQuN2MxOC43NCwxMi41IDM3LjY5LDI0LjgzIDU2LjQxLDM3LjMgMzUuNjEsMjMuNzQgNzYuMzQsNTAuNDUgMTExLjUyLDc1LjkxbDEwNS40MSA4MS4xMWMxMy4xOCwxMC4zNiAzNy45NCwzMi44MSA0OS44Nyw0My44NCAyLjMzLDIuMTYgMy41NywyLjYzIDUuOTQsNC45NyAyLjE4LDIuMTcgMy43MSwzLjc0IDUuOSw1Ljk0IDQuMyw0LjMxIDcuOTgsNy4wNiAxMi4yOCwxMS4zN2w0MC41IDQxLjM5YzIuNTUsMi41NCAzLjE1LDMuOTMgNS40NCw2LjM5bDUzLjQ3IDYyLjk5IDU2LjkyIDgzLjIgMTcuMyAzMC4wMmMzLjE3LDUuMjkgNS4wMSwxMC40OCA4LjQsMTUuMDggMS43Myw1LjQxIDYuMjYsMTMuMTEgOC45NiwxOC41IDQxLjQ1LDgyLjc2IDYyLjE2LDE2Ny44NCA3Mi4wNCwyNjAuOTYgMS4zOSwxMy4xMiA0LjA0LDcwIDIuMzQsODEuMjMgLTAuNjUsNC4yNyAtMS4xMiw0Mi44OSAtMi41OSw1Mi45MSAtMS4yMSw4LjIxIC0xLjY3LDE2Ljc3IC0yLjQzLDI0Ljg3IC01LjYyLDU5LjQ1IC0yNi41NiwxNTAuNTcgLTQ2LjIsMjA0LjkyIC0xNy41Nyw0OC42IC00Ny40MSwxMDIuNTIgLTgyLjcsMTQwLjIybC0yNy4yOSAyOC4yMmMtMjAuOCwyMC44MyAtNjIuOTYsNTAuODYgLTg4LjQ5LDYzLjQ2IC04LjksNC4zOCAtMTcuMzcsOS40IC0yNy45NCwxMy45MiAtNDcuODksMjAuNDUgLTk3LjYzLDM3Ljc0IC0xNTAuNTQsNDUuMDggLTMyLjg4LDQuNTYgLTY2LjIyLDguMzQgLTEwMy41Nyw4LjM0IC03NC4yNywwIC0xNDEuMTQsLTcuNDQgLTIwMS4wMiwtMjEuODMgLTE1My41NSwtMzQuNjkgLTMwNy40MSwtMTA4LjcyIC00MjguNzIsLTIwNS41MWwtNDcuNTggLTM5Ljc3Yy0yLjI0LC0xLjc0IC0yLjQzLC0xLjggLTQuNCwtMy43OWwtNDkuMTMgLTQ2LjQxYy01LjYxLC01LjYgLTkuODIsLTEwLjczIC0xNS40NiwtMTYuMzhsLTU5LjQzIC02Ny45NWMtNC45MSwtNi4yNSAtOS40NCwtMTEuNjYgLTE0LjA0LC0xNy44MWwtMjYuNzYgLTM2LjAyYy0xOC45NiwtMjcuNDcgLTMyLjczLC00OC42NyAtNTAuMDcsLTc3LjMyIC00LjIxLC02Ljk2IC03LjQ3LC0xMy4zNiAtMTEuNjEsLTIwLjI0IC0xMC40NSwtMTcuMzkgLTIzLjc3LC00NC40NCAtMzIuODgsLTYyLjY1bC0yMC40OSAtNDMuMTljLTMuMDksLTcuNjMgLTYuNDcsLTE0LjI4IC05Ljc1LC0yMi4xbC0yNy4zIC02OC4yM2MtMjkuNjcsLTc2Ljg3IC01Mi4zNiwtMTcyLjA5IC02NS43NywtMjUxLjc3IC0zLjE0LC0xOC42NyAtNS4xLC0zNi4zOCAtNy44LC01NS44OSAtMi4yNiwtMTYuMzcgLTUuMzYsLTM0Ljg0IC0yNy43OSwtMzUuOSAtMTAuNjQsLTAuNSAtMjAuNjEsMSAtMjUuNzMsNi4xNSAtNS43NSw1Ljc4IC02LjE0LDE0LjMyIC02LjEzLDI1LjcxIDAuMiwzMzkuMDcgMCw2NzguMTUgMCwxMDE3LjIyIDAsNTQuMzUgLTQuNTcsNTUuNjIgNTQuNjIsNTUuNTMgNS45NSwtMC4wMSA4Ljc3LC0wLjk4IDE1LjQzLC0wLjk1IDExNi40NywwLjYgMjMyLjg0LC0wLjkgMzQ5LjM5LC0wLjkgMTEuNTEsMCAyMC4xNSwwLjkyIDMwLjkzLDAuOTEgMjAuOTMsLTAuMDMgNDEuODYsMCA2Mi43OCwwIDIzLjkzLDAgNTMuNTcsMS45MyA3Ny4zNSwxLjgxIDYuNjYsLTAuMDMgOS40OCwwLjk0IDE1LjQzLDAuOTUgMTEuNTcsMC4wMiAxOS43OCwwLjg0IDMxLDAuODVsMTQ5LjExIDEwLjExYzkuMzYsMC43MyAxOS4yNiwyLjE0IDI5LjE2LDIuNjkgMy44MywwLjIxIDEwLjU0LDEuMSAxMy45NCwxLjUzbDU3Ljg5IDUuOGMxMi40OCwxLjA0IDMyLjQ3LDQuNDcgNDMuODEsNC40NyAxNy40OCwxLjUgMzUuOCw0LjY4IDUzLjYyLDUuNDUgOC4wOSwwLjM1IDE5LjIxLDEuNSAyNi42MywyLjQ5bDI3Ljk0IDIuMDhjNi4wNCwwLjA1IDcuOTcsMC45MiAxMy42NSwwLjkgNi4wOCwtMC4wMiA3LjksMC45NSAxMy42MywwLjkzIDYuMTMsLTAuMDMgOC42NywwLjc2IDEzLjY0LDAuOTEgNS44NSwwLjE4IDEwLjA5LC0wLjAyIDE0LjgzLDAuNjMgNi44MywwLjk0IDQ2LjQsMS4xMyA1Ny4xNSwxLjE2bDAuNTEgMCAwLjQ2IDAgMC40MSAwIDAuMzYgMCAwLjk1IDAgMC45NCAwIDAuOTQgMGMxOS4xNiwtMC4wMyAzNi44OSwtMC4zMyA1NS40MiwtMC44OCA1LC0wLjE1IDcuNDgsLTAuOTggMTMuNjMsLTAuOTIgNi4wNiwwLjA2IDcuODQsLTAuOTcgMTMuNjEsLTAuOTUgOS4zMiwwLjA0IDE5LjQ5LC0xLjM2IDI4LjIzLC0xLjggODguMDIsLTQuMzkgMTcyLjQxLC0xOC41NCAyNTYuOTQsLTM5LjY3IDE2LjU0LC00LjE0IDMxLjMyLC04LjgyIDQ2Ljk1LC0xMy4xMSAxNSwtNC4xMSAzMC4zMSwtOS42NSA0NC43LC0xNC40NCAyOC45OCwtOS42NiA1Ny4yOCwtMjEuMjIgODUuMTYsLTMzLjEzIDQ0LjM4LC0xOC45NiA4Ni4wNiwtNDIuMDYgMTI3Ljk0LC02NC45NWwxOC41MSAtMTAuNmM0MC42MSwtMjIuNTkgNzkuNjksLTQ4Ljk2IDExNS45NSwtNzcuODUgNjYuOTEsLTUzLjMxIDEyMi40NiwtMTE3LjA1IDE2Ni41NiwtMTkwLjExIDExLjI4LC0xOC42OSAyMS42MiwtMzcuNDcgMzEuMDgsLTU3LjE4IDE2LjU4LC0zNC41NCAzMS4zNiwtNzAuMjcgNDEuOTMsLTEwNy4yOSAxNS41LC01NC4yOCAyMy4wMywtODcuNzkgMzEuMywtMTQ2LjEyIDEuMzIsLTkuMyAyLC0xNy4yMSAzLjA0LC0yNi45OGwyLjYgLTI3LjQzYzAuNDMsLTE3LjY3IDMuODUsLTY5LjQyIDEuNTUsLTg2LjIxIC0xLjQ2LC0xMC43IC0xLjM0LC0zOC4xOCAtMy43OCwtNTUuMzcgLTMuNzEsLTI2LjIxIC02LjM5LC01My4wNiAtMTEuNTEsLTc4LjU2IC02LjM4LC0zMS43IC0xMy45MywtNjMuNDMgLTI0LjE1LC05NC4xNCAtOS42MSwtMjguOSAtMTkuOTIsLTU4LjkgLTMzLjExLC04Ni4wOCAtMy4xNywtNi41MyAtNS45LC0xMy41NSAtOS4wOSwtMjAuMDMgLTE2LjA0LC0zMi41NyAtMzIuOTEsLTY1LjA2IC01My4xNCwtOTUuMTYgLTQuMjUsLTYuMzIgLTcuNiwtMTEuODUgLTExLjgzLC0xOC4xOSAtNC4yNiwtNi4zOSAtOC4wMywtMTEuNjEgLTEyLjE4LC0xNy44NCAtMi4xNCwtMy4yMSAtMy43OCwtNS4xNyAtNi4wMSwtOC41NSAtMTAuODUsLTE2LjQ1IC0yNS4zNCwtMzUuMDQgLTM3LjczLC01MC41M2wtNzQuMDkgLTg5LjY5Yy04LjQ2LC0xMC4xMiAtMzAuNjgsLTMxLjY0IC0zNS44NiwtMzcuODQgLTIuOTIsLTMuNSAtNC4xLC00LjkzIC03LjMyLC04LjE0IC0yLjYzLC0yLjYzIC00LjU4LC00LjcyIC03LjI2LC03LjNsLTMwLjQ4IC0yOC42NmMtMTkuNTgsLTE5LjM4IC02Ny41MywtNTcuMTcgLTg5Ljg3LC03My45MWwtMTA0Ljk5IC03My4zNGMtMy4yNywtMi4xOCAtNS43NSwtMy41IC04LjkyLC01LjYzbC0xNy42NiAtMTEuNDZjLTEzLjk2LC05LjM1IC03My41OCwtNDguMTkgLTgyLjQxLC01Mi40MWwtNTEuMDggLTMyLjQ3Yy0zMi43MywtMTkuMzUgLTY5Ljc2LC00NC40MSAtMTAzLjE0LC02NC4yN2wtNTEuNzkgLTMxLjkyYy00LjQ2LC0yLjkzIC04LjQ5LC01LjE5IC0xMi45MywtOCAtMi4yMiwtMS40IC0zLjkxLC0yLjM1IC02LjI2LC0zLjc0bC00NC42MiAtNTEuODdjLTguOTksLTUuMzIgLTE3LC0xMC41NCAtMjUuOTMsLTE1LjkyIC04LjkyLC01LjM4IC0xNi45LC0xMC41NCAtMjUuOTIsLTE1LjkzbC0xMzAuMSAtODAuMDhjLTI1LjY1LC0xNS4yNiAtNTEuNzcsLTMyLjc4IC03Ny4yNSwtNDguMzFsLTUwLjYxIC0zMy4xYy00NS40MiwtMzAuMjggLTc5LjU1LC01NS4wMiAtMTIyLjE0LC04Ny4xM2wtNjkuNjggLTU2LjgxYy0yLjAxLC0zLjA4IC0yMy43LC0yMi4yMiAtMjcuOTIsLTI1Ljc0bC0yNy4zMyAtMjYuMzRjLTIwLjExLC0yMC4xMSAtNDIuMTUsLTQ0IC02MC41NiwtNjUuOTFsLTUwLjAxIC02NC42M2MtOS40NywtMTIuNjEgLTIzLjk1LC0zNS42NCAtMzEuOTksLTQ4Ljk5IC0yNy4wOSwtNDUuMDUgLTQ5Ljk5LC05Mi44NSAtNjcuOTYsLTE0Ni43NyAtMTUuMzQsLTQ2LjAxIC0yOC43MSwtMTA1LjcyIC0zMi41NywtMTU1Ljc3IC0wLjM4LC00Ljg0IC0wLjk3LC04LjI5IC0xLC0xMi42NCAtMC4wNCwtNS44MiAtMC43NywtNy45NCAtMC45MSwtMTIuNzQgLTAuNTIsLTE3LjQ2IC0wLjg4LC0zNC4zNCAtMC44OCwtNTIuOCAwLC0yNy4zMSA0LjI1LC03NC4xMyA3LjkyLC05OS40NSAxNC4zNiwtOTkuMjYgNTAuMjQsLTE4Ni41OSAxMTIuODEsLTI2My44N2wzNy44MSAtNDIuMjVjMi41LC0yLjUgNC4zNCwtNC4zMiA2LjgyLC02LjgzIDguODIsLTguOTEgMzkuNzMsLTM1LjA0IDUxLC00Mi43MSAzNS42MiwtMjQuMjMgNDIuNjcsLTI5LjY3IDg0Ljg5LC01MC43N2wyNC41OSAtMTAuOGM4Ljg3LC0zLjY0IDE3LjQyLC02Ljc5IDI2LjM4LC0xMC4wMiAzMi40OSwtMTEuNjggNzkuMDEsLTIzLjY4IDExNC4yNiwtMjkuNDkgMjAuNTIsLTMuMzggNjAuMjksLTkgODEuMjUsLTguODMgNi45MywwLjA1IDEwLjEsLTAuOTYgMTcuMjcsLTAuOTNsNTMuMTYgMS40NGM0LjczLDAuNzEgMTIuNDIsMS4xMSAxNi45LDEuMzEgMjUuMTIsMS4wNyA2OC42NCwxMC42MyA5MS4xLDE3LjE3IDE5LjIxLDUuNiAzNi40MSwxMi4xMSA1My43MSwxOS4wNyAyMy41MSw5LjQ3IDM5LjYsMTkuMjYgNTkuOTEsMjkuMjUgMy45LDEuOTIgNy44MSw0LjIzIDExLjY1LDYuNTUgNC4wMywyLjQyIDcuMzcsNC4yMyAxMS40OSw2LjcxbDMyLjkxIDIwLjc4YzQ1LjY3LDMwLjQ0IDkxLjgyLDY2LjA5IDEzMi45OCwxMDIuNjcgMTMuNDcsMTEuOTcgMzUuMTIsMzAuNDcgNDcuMzEsNDIuNzcgNi4wMiw2LjA3IDMyLjIxLDMzLjYxIDM2Ljk3LDM2LjE3eiIvPg0KICA8L2c+DQogPC9nPg0KPC9zdmc+DQo=";

/* ═══ ICONS ═══ */
const I = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  invoice: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  credit: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  gear: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  dots: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>,
  download: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  link: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  send: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  dollar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  patients: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  menu: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  chevL: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevR: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  clock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  eye: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  mail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  msg: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  lock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  globe: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
};

/* ═══ HELPERS ═══ */
const DIAS_ES = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const HORAS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];
const UBICACIONES = ['','Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Guam','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Puerto Rico','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','U.S. Virgin Islands','Utah','Vermont','Virginia','Washington','Washington D.C.','West Virginia','Wisconsin','Wyoming','Otro'];
const TC = {
  Individual:{bg:"#f0f5f0",text:"#2a3528",dot:"#4a7a4a"},
  Pareja:{bg:"#e8eff4",text:"#2b4a6e",dot:"#5a82b0"},
  Familiar:{bg:"#f3ecf4",text:"#5a3a5a",dot:"#8b5a8b"},
};
TC["Evaluación"] = {bg:"#f5f0e6",text:"#6b5a14",dot:"#c4956a"};

const TODAY = new Date(2026,3,6);

function dkey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + dd;
}
function getMon(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}
function addD(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function sameD(a, b) { return dkey(a) === dkey(b); }


function absUrl(url) { if (!url) return ''; return /^https?:\/\//i.test(url) ? url : 'https://' + url; }

/* ═══ REUSABLE ═══ */
function Modal({open,onClose,title,children,width=520,dark=false,zIndex=1000}){
  if(!open) return null;
  return(
    <div style={{position:'fixed',inset:0,zIndex,background:'rgba(42,53,40,.45)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn .18s'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:dark?'#1e1e1e':'#fdfcfa',borderRadius:16,width:'92%',maxWidth:width,maxHeight:'88vh',overflow:'auto',boxShadow:'0 20px 60px rgba(42,53,40,.25)',animation:'slideUp .22s',border:dark?'1px solid #333':'1px solid #e2ede2'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 22px 12px',borderBottom:dark?'1px solid #333':'1px solid #e2ede2'}}>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:19,color:dark?'#e0e0e0':'#2a3528'}}>{title}</h3>
          <button onClick={onClose} style={{border:'none',background:dark?'#2a2a2a':'#f0f5f0',borderRadius:9,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#849884'}}>{I.close}</button>
        </div>
        <div style={{padding:'16px 22px 22px'}}>{children}</div>
      </div>
    </div>
  );
}

function Field({label,children}){
  return <div style={{marginBottom:14}}><label style={{display:'block',fontSize:11,fontWeight:500,color:'#849884',marginBottom:5,letterSpacing:'.5px',textTransform:'uppercase',fontFamily:"'DM Sans',sans-serif"}}>{label}</label>{children}</div>;
}

function DropMenu({items,onClose}){
  const ref=useRef();
  useEffect(()=>{
    const h = e => { if(ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown',h);
    return () => document.removeEventListener('mousedown',h);
  },[onClose]);
  return(
    <div ref={ref} style={{position:'absolute',right:0,top:'100%',marginTop:4,background:'#fdfcfa',borderRadius:12,boxShadow:'0 8px 30px rgba(42,53,40,.12)',border:'1px solid #e2ede2',minWidth:190,zIndex:50,overflow:'hidden',animation:'fadeIn .12s'}}>
      {items.map((it,i) => it.divider
        ? <div key={i} style={{height:1,background:'#e2ede2',margin:'4px 0'}}/>
        : <button key={i} onClick={()=>{it.action();onClose()}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 16px',border:'none',background:'none',cursor:'pointer',fontSize:13,color:it.danger?'#C62828':'#4e6050',fontFamily:"'DM Sans',sans-serif",textAlign:'left'}}
            onMouseEnter={e=>e.currentTarget.style.background='#f0f5f0'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
            <span style={{color:it.danger?'#C62828':'#849884',display:'flex'}}>{it.icon}</span>{it.label}
          </button>
      )}
    </div>
  );
}

/* ═══ INVOICE HTML ═══ */
function makeInvHTML(inv, acc, payMethods = []) {
  const e = escapeHtml;
  const parts = [];
  parts.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprobante de Pago</title>');
  parts.push('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;color:#2a3528;padding:40px}');
  parts.push('.c{max-width:680px;margin:0 auto;border:1px solid #e2ede2;border-radius:8px;overflow:hidden}');
  parts.push('.h{background:#2a3528;color:#fff;padding:30px 36px;display:flex;justify-content:space-between;align-items:center}');
  parts.push('.logo{font-size:22px;font-weight:400;letter-spacing:2px;color:#c8ddc8;font-family:Georgia,serif}');
  parts.push('.b{padding:32px 36px}.ir{display:flex;justify-content:space-between;margin-bottom:28px}');
  parts.push('.ib h4{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#849884;margin-bottom:5px}.ib p{font-size:13px;line-height:1.6}');
  parts.push('table{width:100%;border-collapse:collapse;margin:18px 0}th{background:#f0f5f0;padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#849884}');
  parts.push('td{padding:11px 14px;border-bottom:1px solid #e2ede2;font-size:13px}.tr td{font-weight:700;font-size:15px;border-top:2px solid #2a3528;border-bottom:none}');
  parts.push('.f{background:#f0f5f0;padding:18px 36px;text-align:center;font-size:11px;color:#849884}');
  parts.push('.bd{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}');
  parts.push('.bp{background:#f0f5f0;color:#4a7a4a}.bpn{background:#FFF8E1;color:#F57F17}.bv{background:#FFEBEE;color:#C62828}');
  parts.push('.lb{margin:18px 0;padding:12px 18px;background:#f0f5f0;border:1px solid #c8ddc8;border-radius:8px;text-align:center}');
  parts.push('.lb a{color:#4a7a4a;font-weight:600;font-size:13px;text-decoration:none}');
  parts.push('</style></head><body><div class="c">');
  const num = String(inv.id).padStart(4,'0');
  parts.push('<div class="h"><div class="logo">Lda. Silvana López</div><div style="text-align:right"><div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.6">Comprobante de Pago</div><div style="font-size:18px;font-weight:700;margin-top:4px">#' + e(num) + '</div></div></div>');
  parts.push('<div class="b"><div class="ir">');
  parts.push('<div class="ib"><h4>De</h4><p><strong>' + e(acc.nombre) + '</strong><br>' + e(acc.especialidad) + '<br>Ced. Prof. ' + e(acc.cedula) + '<br>' + e(acc.email) + '<br>' + e(acc.telefono) + '</p></div>');
  const bc = inv.estado === 'pagada' ? 'bp' : inv.estado === 'pendiente' ? 'bpn' : 'bv';
  parts.push('<div class="ib" style="text-align:right"><h4>Para</h4><p><strong>' + e(inv.paciente) + '</strong></p><h4 style="margin-top:14px">Fecha</h4><p>' + e(inv.fecha) + '</p><h4 style="margin-top:14px">Estado</h4><p><span class="bd ' + bc + '">' + e(inv.estado) + '</span></p></div></div>');
  parts.push('<table><thead><tr><th>Concepto</th><th>Cant.</th><th style="text-align:right">Monto</th></tr></thead>');
  parts.push('<tbody><tr><td>' + e(inv.concepto) + '</td><td>1</td><td style="text-align:right">$' + e(String(inv.monto.toLocaleString())) + ' USD</td></tr>');
  parts.push('<tr class="tr"><td colspan="2">Total</td><td style="text-align:right">$' + e(String(inv.monto.toLocaleString())) + ' USD</td></tr></tbody></table>');
  if (inv.estado !== 'pagada') {
    if (inv.link) {
      parts.push('<div class="lb"><div style="font-size:10px;color:#849884;margin-bottom:5px">LINK DE PAGO</div><a href="' + e(absUrl(inv.link)) + '">' + e(inv.link) + '</a></div>');
      const linkMet = (payMethods || []).find(m => String(m.id) === String(inv.metodo_pago));
      if (linkMet?.tiempoConfirm) parts.push('<div style="text-align:center;font-size:11px;color:#849884;margin-top:-10px;margin-bottom:12px">Expiración del link: ' + e(linkMet.tiempoConfirm) + '</div>');
    } else {
      const activeMethods = (payMethods || []).filter(m => m.activo);
      if (activeMethods.length > 0) {
        parts.push('<div style="margin:18px 0;padding:16px 18px;background:#f0f5f0;border:1px solid #c8ddc8;border-radius:8px">');
        parts.push('<div style="font-size:10px;color:#849884;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;text-align:center">MÉTODOS DE PAGO DISPONIBLES</div>');
        activeMethods.forEach(m => {
          const r = '<div style="font-size:12px;color:#5a6b58">';
          parts.push('<div style="padding:10px 14px;background:#fff;border:1px solid #e2ede2;border-radius:6px;margin-bottom:8px">');
          parts.push('<div style="font-weight:600;font-size:13px;color:#2a3528;margin-bottom:4px">' + e(m.nombre) + '</div>');
          if (m.titular) parts.push(r + 'Titular: ' + e(m.titular) + '</div>');
          if (m.banco) parts.push(r + 'Banco: ' + e(m.banco) + '</div>');
          if (m.cuentaVisible) parts.push(r + 'Cuenta: ' + e(m.cuentaVisible) + '</div>');
          if (m.idComercio) parts.push(r + 'ABA Routing: ' + e(m.idComercio) + '</div>');
          if (m.clavePublica && m.tipo === 'Transferencia') parts.push(r + 'Swift: ' + e(m.clavePublica) + '</div>');
          if (m.claveSecreta && m.tipo === 'Transferencia') parts.push(r + 'Dirección sucursal: ' + e(m.claveSecreta) + '</div>');
          if (m.politicaReembolso && m.tipo === 'Transferencia') parts.push(r + 'Dirección titular: ' + e(m.politicaReembolso) + '</div>');
          if (m.correoProveedor) parts.push(r + 'Correo: ' + e(m.correoProveedor) + '</div>');
          if (m.moneda) parts.push(r + 'Moneda: ' + e(m.moneda) + '</div>');
          if (m.tiempoConfirm) parts.push(r + 'Confirmación: ' + e(m.tiempoConfirm) + '</div>');
          if (m.recargoPct > 0) parts.push('<div style="font-size:11px;color:#b08050;margin-top:2px">Recargo: ' + m.recargoPct + '%</div>');
          if (m.instrucciones) parts.push('<div style="font-size:11px;color:#849884;margin-top:4px;font-style:italic">' + e(m.instrucciones) + '</div>');
          parts.push('</div>');
        });
        parts.push('<div style="text-align:center;margin-top:4px"><span style="color:#b08050;font-style:italic;font-size:12px">Sin enlace de pago</span></div>');
        parts.push('</div>');
      } else {
        parts.push('<div class="lb"><div style="font-size:10px;color:#849884;margin-bottom:5px">LINK DE PAGO</div><span style="color:#b08050;font-style:italic">Sin enlace de pago</span></div>');
      }
    }
  }
  parts.push('</div><div class="f">Lda. Silvana López · Psicoterapia Online · silvana@psicoterapia.com</div></div></body></html>');
  return parts.join('');
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function SilvanaDashboard({ userEmail, userName, initialSettings, initialServices, initialInvoices, initialBookings, initialPaymentMethods, initialLinks, availablePaymentLinks = [], initialExceptions = [], googleStatus = { connected: false } }: DashboardClientProps) {
  const [section, setSection] = useState('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const show = msg => { setToast(msg); setTimeout(() => setToast(null), 2800); };
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const g = p.get('google');
    if (!g) return;
    if (g === 'connected') show('Google conectado');
    else if (g === 'error') show('Error de Google: ' + (p.get('reason') || 'desconocido'));
    const url = new URL(window.location.href);
    url.searchParams.delete('google');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const [account, setAccount] = useState({
    nombre: initialSettings?.nombre || userName || 'Lda. Silvana López',
    especialidad: initialSettings?.especialidad || 'Psicoterapia Online',
    cedula: initialSettings?.cedula || 'PSI-2024-1876',
    email: initialSettings?.email || userEmail,
    telefono: initialSettings?.telefono || '+54 9 11 5678-1234',
    direccion: initialSettings?.direccion || 'Consulta Online',
    bio: initialSettings?.bio || 'Licenciada en Psicología, especialista en psicoterapia online. Acompaño procesos de bienestar emocional desde un enfoque cálido y personalizado.'
  });
  // Multi-range working_hours: { day: {enabled, ranges: [{start,end}]} } máx 3 por día
  const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const DAY_LABELS_ES = {monday:'Lunes',tuesday:'Martes',wednesday:'Miércoles',thursday:'Jueves',friday:'Viernes',saturday:'Sábado',sunday:'Domingo'};
  const DAY_LABELS_SHORT = {monday:'Lun',tuesday:'Mar',wednesday:'Mié',thursday:'Jue',friday:'Vie',saturday:'Sáb',sunday:'Dom'};
  const normalizeWH = (wh) => {
    const out = {};
    DAY_KEYS.forEach(d => {
      const v = wh?.[d] || {};
      if (v.ranges) {
        out[d] = { enabled: !!v.enabled, ranges: v.ranges.map(r => ({start:r.start, end:r.end})) };
      } else if (v.start && v.end) {
        out[d] = { enabled: !!v.enabled, ranges: v.enabled ? [{start:v.start, end:v.end}] : [] };
      } else {
        out[d] = { enabled: false, ranges: [] };
      }
    });
    return out;
  };
  const defaultWH = {
    monday:    {enabled:true,  ranges:[{start:'09:00',end:'18:00'}]},
    tuesday:   {enabled:true,  ranges:[{start:'09:00',end:'18:00'}]},
    wednesday: {enabled:true,  ranges:[{start:'09:00',end:'18:00'}]},
    thursday:  {enabled:true,  ranges:[{start:'09:00',end:'18:00'}]},
    friday:    {enabled:true,  ranges:[{start:'09:00',end:'14:00'}]},
    saturday:  {enabled:false, ranges:[]},
    sunday:    {enabled:false, ranges:[]},
  };
  const [workingHours, setWorkingHours] = useState(normalizeWH(initialSettings?.working_hours) || defaultWH);
  const [editAcc, setEditAcc] = useState(false);
  const [accF, setAccF] = useState({...account});

  // Disponibilidad section state
  const [whDraft, setWhDraft] = useState(JSON.parse(JSON.stringify(workingHours)));
  const [exceptions, setExceptions] = useState(initialExceptions || []);
  const [excModal, setExcModal] = useState(false);
  const [excEditId, setExcEditId] = useState(null);
  const [savingExc, setSavingExc] = useState(false);
  const todayISO = new Date().toISOString().slice(0,10);
  const emptyExcForm = {title:'',type:'dates',dates:[],newDateInput:'',start_date:'',end_date:'',start_time:'09:00',end_time:'13:00',all_day:true,days_of_week:[],notes:''};
  const [excF, setExcF] = useState(emptyExcForm);

  const formatWorkingHours = (wh) => {
    return DAY_KEYS.filter(k => wh[k]?.enabled && wh[k]?.ranges?.length)
      .map(k => DAY_LABELS_SHORT[k] + ' ' + wh[k].ranges.map(r => r.start+'-'+r.end).join(', '))
      .join(' · ');
  };

  const saveWorkingHours = async () => {
    setWorkingHours(JSON.parse(JSON.stringify(whDraft)));
    try {
      await updateProfile({...account, working_hours: whDraft});
      show('Horario laboral guardado');
    } catch(e) { show('Error al guardar horario'); }
  };

  const openExcModal = (exc) => {
    if (exc) {
      setExcEditId(exc.id);
      setExcF({
        title: exc.title || '',
        type: exc.type || 'dates',
        dates: exc.dates || [],
        newDateInput: '',
        start_date: exc.start_date || '',
        end_date: exc.end_date || '',
        start_time: exc.start_time || '09:00',
        end_time: exc.end_time || '13:00',
        all_day: !!exc.all_day,
        days_of_week: exc.days_of_week || [],
        notes: exc.notes || '',
      });
    } else {
      setExcEditId(null);
      setExcF({...emptyExcForm});
    }
    setExcModal(true);
  };

  const saveException = async () => {
    if (savingExc) return;
    if (!excF.title.trim()) { show('Falta el título'); return; }
    // Reglas de fechas: no permitir fechas pasadas al crear (sí al editar una existente)
    if (!excEditId) {
      if (excF.type === 'dates') {
        if (excF.dates.length === 0) { show('Agrega al menos una fecha'); return; }
        if (excF.dates.some(d => d < todayISO)) { show('No puedes bloquear fechas pasadas'); return; }
      }
      if (excF.type === 'range') {
        if (!excF.start_date || !excF.end_date) { show('Indica desde y hasta'); return; }
        if (excF.start_date < todayISO) { show('La fecha "desde" no puede ser pasada'); return; }
        if (excF.end_date < excF.start_date) { show('"Hasta" debe ser ≥ "desde"'); return; }
      }
      if (excF.type === 'recurring') {
        if (!excF.start_date) { show('Indica fecha de inicio'); return; }
        if (excF.start_date < todayISO) { show('La fecha de inicio no puede ser pasada'); return; }
        if (excF.end_date && excF.end_date < excF.start_date) { show('"Hasta" debe ser ≥ "desde"'); return; }
        if (!excF.days_of_week.length) { show('Selecciona al menos un día de la semana'); return; }
      }
    }
    setSavingExc(true);
    try {
      const payload: any = {
        id: excEditId || undefined,
        title: excF.title.trim(),
        type: excF.type,
        start_date: excF.start_date || null,
        end_date: excF.end_date || null,
        start_time: excF.all_day ? null : excF.start_time,
        end_time: excF.all_day ? null : excF.end_time,
        all_day: !!excF.all_day,
        days_of_week: excF.type === 'recurring' ? excF.days_of_week : null,
        notes: excF.notes || null,
        dates: excF.type === 'dates' ? excF.dates : undefined,
      };
      const res = await upsertAvailabilityException(payload);
      if (!res.success) { show(res.error || 'Error al guardar excepción'); return; }
      // Update local state so lista se refresca sin recargar
      const newRow = {
        id: res.id || excEditId,
        title: payload.title,
        type: payload.type,
        start_date: payload.start_date,
        end_date: payload.end_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        all_day: payload.all_day,
        days_of_week: payload.days_of_week,
        notes: payload.notes,
        dates: payload.dates || [],
      };
      setExceptions(prev => {
        const exists = prev.some(e => e.id === newRow.id);
        return exists ? prev.map(e => e.id === newRow.id ? { ...e, ...newRow } : e) : [...prev, newRow];
      });
      setExcModal(false);
      show(excEditId ? 'Excepción actualizada' : 'Excepción creada');
      router.refresh();
    } finally {
      setSavingExc(false);
    }
  };

  const removeException = async (id) => {
    setExceptions(p => p.filter(e => e.id !== id));
    try { await deleteAvailabilityException(id); show('Excepción eliminada'); }
    catch(e) { show('Error al eliminar'); }
  };

  /* Services */
  const [services, setServices] = useState(() => {
    if (initialServices && initialServices.length > 0) {
      return initialServices.map(s => ({ id: s.id, nombre: s.name, descripcion: s.description || '', color: s.color || '#8fb08f', active: s.active !== false, duracion: s.duration_min || 50, precio: s.price || '', is_free: s.is_free ?? false, modalidad: s.modality || 'Online · Videollamada', features: Array.isArray(s.features) ? s.features.join('\n') : '', tag: s.tag || '', typeLabel: s.type_label || '', subtitle: s.subtitle || '', precioTipo: s.is_free ? 'gratis' : (s.price ? 'precio' : 'oculto') }));
    }
    return [];
  });
  const [svcModal, setSvcModal] = useState(false);
  const [svcF, setSvcF] = useState({nombre:'',descripcion:'',color:'#8fb08f',duracion:50,precioTipo:'oculto',precio:'',modalidad:'Online · Videollamada',features:'',tag:'',typeLabel:'',subtitle:''});
  const [eSvcId, setESvcId] = useState(null);

  /* Security */
  const [secEmail, setSecEmail] = useState(userEmail || '');
  const [secNewEmail, setSecNewEmail] = useState('');
  const [secPwd, setSecPwd] = useState({current:'',new1:'',new2:''});
  const [secQuestion, setSecQuestion] = useState(initialSettings?.security_question || '¿Nombre de tu primera mascota?');
  const [secAnswer, setSecAnswer] = useState(initialSettings?.security_answer || '');
  const [recoveryEmail, setRecoveryEmail] = useState('silvana.backup@gmail.com');
  const [secEditModal, setSecEditModal] = useState(null); /* 'email'|'password'|'question'|'recovery'|null */
  const [showPwd, setShowPwd] = useState({current:false,new1:false,new2:false,answer:false});

  const [darkMode, setDarkMode] = useState(false);
  const [nickname, setNickname] = useState(initialSettings?.nickname || 'Silvana');
  const [contactEmail, setContactEmail] = useState(initialSettings?.contact_email || '');
  const [contactPhone, setContactPhone] = useState(initialSettings?.contact_phone || '');
  const [availPayLinks, setAvailPayLinks] = useState(availablePaymentLinks.map(pl => ({ id: pl.id, url: pl.url, provider: pl.provider, amount: pl.amount, total: pl.total, status: pl.status })));

  /* Dynamic theme tokens — Silvana palette */
  const dm = darkMode;
  const CARD = {background:dm?'#1e1e1e':'#fdfcfa',borderRadius:14,boxShadow:dm?'0 1px 4px rgba(0,0,0,.3)':'0 1px 3px rgba(74,122,74,.06), 0 3px 12px rgba(74,122,74,.04)',border:dm?'1px solid #2a2a2a':'1px solid #e2ede2'};
  const inp = {width:'100%',padding:'10px 13px',borderRadius:10,border:dm?'1.5px solid #333':'1.5px solid #c8ddc8',fontSize:14,fontFamily:"'DM Sans',sans-serif",color:dm?'#e0e0e0':'#2a3528',background:dm?'#252525':'#fdfcfa',outline:'none',transition:'border .2s',boxSizing:'border-box'};
  const sel = {...inp,appearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23849884' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center'};
  const btnP = {padding:'10px 22px',borderRadius:11,border:'none',background:'linear-gradient(135deg,#4a7a4a 0%,#3a6a3a 100%)',color:'#fff',fontWeight:500,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",boxShadow:'0 2px 10px rgba(74,122,74,.25)',transition:'all .15s',display:'inline-flex',alignItems:'center',gap:7};
  const btnS = {...btnP,background:dm?'#2a2a2a':'#f0f5f0',color:dm?'#ccc':'#4e6050',boxShadow:'none'};
  const bdg = c => ({display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:'.3px',textTransform:'uppercase',background:c==='green'?'#f0f5f0':c==='yellow'?'#FFF8E1':c==='red'?'#FFEBEE':dm?'#2a2a2a':'#f0f5f0',color:c==='green'?'#4a7a4a':c==='yellow'?'#F57F17':c==='red'?'#C62828':'#4e6050'});
  const txSub = dm ? '#999' : '#849884';
  const txMain = dm ? '#e0e0e0' : '#2a3528';
  const bgMain = dm ? '#141414' : '#fdfcfa';
  const bgSub = dm ? '#1a1a1a' : '#f0f5f0';
  const borderC = dm ? '#2a2a2a' : '#e2ede2';
  const [notepad, setNotepad] = useState(initialSettings?.notepad || '');

  // ─── Payment status badges ───────────────────────────────
  // Unified visual language for payment_link.status across the UI.
  const PAY_BADGE: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
    paid:      { label: 'Pagado',     bg: '#e8f5e9', fg: '#2e7d32', dot: '#2e7d32' },
    active:    { label: 'Activo',     bg: '#e3f2fd', fg: '#1565c0', dot: '#1565c0' },
    pending:   { label: 'Pendiente',  bg: '#fff8e1', fg: '#b08050', dot: '#b08050' },
    expired:   { label: 'Expirado',   bg: '#fafafa', fg: '#757575', dot: '#9e9e9e' },
    failed:    { label: 'Fallido',    bg: '#ffebee', fg: '#c62828', dot: '#c62828' },
    cancelled: { label: 'Cancelado',  bg: '#f5f5f5', fg: '#616161', dot: '#9e9e9e' },
  };
  const PayBadge = ({ status, size = 'sm' }: { status: string; size?: 'sm'|'md' }) => {
    const cfg = PAY_BADGE[status] || PAY_BADGE.pending;
    const pad = size === 'md' ? '4px 11px' : '2px 8px';
    const fs  = size === 'md' ? 11 : 10;
    return (
      <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:pad,borderRadius:10,background:cfg.bg,color:cfg.fg,fontSize:fs,fontWeight:600,letterSpacing:'.3px',textTransform:'uppercase'}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:cfg.dot}}/>
        {cfg.label}
      </span>
    );
  };
  // Derive a booking-level payment summary from its payment_links
  const bookingPayState = (booking: any): string | null => {
    const links = booking?.paymentLinks || [];
    if (!links.length) return null;
    if (links.some((l: any) => l.status === 'paid'))    return 'paid';
    if (links.some((l: any) => l.status === 'failed'))  return 'failed';
    if (links.some((l: any) => l.status === 'active'))  return 'active';
    if (links.some((l: any) => l.status === 'pending')) return 'pending';
    if (links.some((l: any) => l.status === 'expired')) return 'expired';
    return links[0].status;
  };

  // ─── Integraciones ────────────────────────────────────────
  const [smtpCfg, setSmtpCfg] = useState({
    host:       initialSettings?.smtp_host       || '',
    port:       initialSettings?.smtp_port       || 587,
    user:       initialSettings?.smtp_user       || '',
    password:   initialSettings?.smtp_password   || '',
    from_email: initialSettings?.smtp_from_email || '',
    from_name:  initialSettings?.smtp_from_name  || '',
    secure:     initialSettings?.smtp_secure     || false,
  });
  const defaultWaTpls: Record<string,string> = {
    booking_received:  'Hola {cliente} 👋 Recibí tu solicitud de *{servicio}* para el {fecha} a las {hora}. Te confirmo en breve.',
    booking_confirmed: 'Hola {cliente} ✅ Tu cita de *{servicio}* queda confirmada para el {fecha} a las {hora} (hora Miami). ¡Nos vemos!',
    payment_link:      'Hola {cliente} 💳 Aquí está tu enlace de pago para *{servicio}*: {link}. Monto: {precio} USD.',
    reschedule:        'Hola {cliente} 🔁 Tu cita de *{servicio}* fue reprogramada para el {fecha} a las {hora}. Cualquier duda, avísame.',
    reminder_24h:      'Hola {cliente} ⏰ Te recuerdo tu cita de *{servicio}* mañana {fecha} a las {hora} (hora Miami).',
    custom:            'Hola {cliente}, ',
  };
  const [waTpls, setWaTpls] = useState<Record<string,string>>(() => {
    const fromDb = initialSettings?.wa_templates || {};
    return { ...defaultWaTpls, ...fromDb };
  });
  const [waPicker, setWaPicker] = useState<{open: boolean; booking: any; event: string}>({open: false, booking: null, event: 'custom'});

  const saveSmtpCfg = async () => {
    const res = await updateIntegrations({
      smtp_host:       smtpCfg.host       || null,
      smtp_port:       Number(smtpCfg.port) || null,
      smtp_user:       smtpCfg.user       || null,
      smtp_password:   smtpCfg.password   || null,
      smtp_from_email: smtpCfg.from_email || null,
      smtp_from_name:  smtpCfg.from_name  || null,
      smtp_secure:     !!smtpCfg.secure,
    });
    if (res.success) show('Configuración de correo guardada'); else show(res.error || 'Error al guardar');
  };
  const saveWaTpls = async () => {
    const res = await updateWaTemplates(waTpls);
    if (res.success) show('Plantillas guardadas'); else show(res.error || 'Error al guardar');
  };

  // Email notification preferences (per event / per recipient)
  const emailEventLabels: Record<string, string> = {
    booking_received:    'Reserva recibida',
    booking_confirmed:   'Reserva confirmada',
    booking_rejected:    'Reserva rechazada',
    booking_cancelled:   'Reserva cancelada',
    booking_rescheduled: 'Reserva reprogramada',
    payment_link:        'Enlace de pago enviado',
    reminder_24h:        'Recordatorio 24h antes',
    invoice:             'Factura enviada',
  };
  const emailEventShape: Record<string, ('client'|'admin')[]> = {
    booking_received:    ['client','admin'],
    booking_confirmed:   ['client'],
    booking_rejected:    ['client'],
    booking_cancelled:   ['client','admin'],
    booking_rescheduled: ['client'],
    payment_link:        ['client'],
    reminder_24h:        ['client'],
    invoice:             ['client'],
  };
  const [emailNotifs, setEmailNotifs] = useState<Record<string,Record<string,boolean>>>(() => {
    const fromDb = (initialSettings?.email_notifications || {}) as Record<string,Record<string,boolean>>;
    const out: Record<string,Record<string,boolean>> = {};
    for (const [ev, recips] of Object.entries(emailEventShape)) {
      out[ev] = {};
      for (const r of recips) {
        out[ev][r] = fromDb[ev]?.[r] ?? true;
      }
    }
    return out;
  });
  const toggleEmailNotif = (event: string, recipient: string) => {
    setEmailNotifs(prev => ({
      ...prev,
      [event]: { ...prev[event], [recipient]: !prev[event]?.[recipient] },
    }));
  };
  const saveEmailNotifs = async () => {
    const res = await updateEmailNotifications(emailNotifs);
    if (res.success) show('Preferencias de correo guardadas'); else show(res.error || 'Error al guardar');
  };

  // Render a WA template with a booking's data
  const buildWaMessageFor = (booking: any, event: string): string => {
    const tpl = waTpls[event] || waTpls.custom || '';
    const svcName = booking?.tipo || '';
    const svc = services.find((s:any)=>s.nombre===svcName);
    const precio = svc && !svc.is_free ? svc.precio : '';
    return renderTemplate(tpl, {
      cliente:  booking?.paciente || '',
      servicio: svcName,
      fecha:    booking?.fecha || '',
      hora:     booking?.hora || '',
      precio,
      link:     '',
      motivo:   booking?.motivo || '',
    });
  };

  const openWaFor = (booking: any, event: string) => {
    const msg = buildWaMessageFor(booking, event);
    const url = buildWaLink(booking?.telefono, msg);
    if (!url) {
      // Fallback: open picker with copy-paste area
      setWaPicker({open: true, booking, event});
      show('Teléfono inválido — copia y pega el mensaje');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const [tutorialLinks, setTutorialLinks] = useState(() => {
    if (initialLinks && initialLinks.length > 0) return initialLinks.map(l => ({id:l.id,title:l.title,url:l.url}));
    return [];
  });
  const [newLink, setNewLink] = useState({title:'',url:''});
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const [invoices, setInvoices] = useState(initialInvoices || []);
  const [invModal, setInvModal] = useState(false);
  const [invF, setInvF] = useState({paciente:'',email:'',telefono:'',cedula:'',pais:'',direccion:'',concepto:'',monto:'',estado:'pendiente',metodoPago:'',link:'',bookingId:''});
  const [eInvId, setEInvId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [invFilter, setInvFilter] = useState('todos');
  const [invSearch, setInvSearch] = useState('');
  const [delInvConfirm, setDelInvConfirm] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const [reservas, setReservas] = useState(() => {
    if (initialBookings && initialBookings.length > 0) {
      const statusToEs = {pending:'pendiente',confirmed:'confirmada',cancelled:'cancelada',completed:'completada',rejected:'rechazada',accepted:'aceptada',payment_pending:'pago pendiente',rescheduled:'reagendada',expired:'expirada'};
      return initialBookings.map(b => {
        const dt = b.preferred_date ? new Date(b.preferred_date) : null;
        return {
          id: b.id,
          paciente: b.client?.full_name || '',
          email: b.client?.email || '',
          telefono: b.client?.phone || '',
          fecha: dt ? dt.toISOString().slice(0, 10) : '',
          hora: dt ? dt.toISOString().slice(11, 16) : '',
          duracion: b.service?.duration_min || 60,
          tipo: b.service?.name || '',
          serviceId: b.service_id || '',
          notas: b.admin_notes || '',
          estado: statusToEs[b.status] || b.status || 'pendiente',
          pais: b.client?.country || '',
          motivo: b.client?.reason || '',
          preferenciaPago: b.preferred_payment || '',
          meetLink: b.meet_link || '',
          paymentLinks: (b.payment_links || []).map(pl => ({
            id: pl.id,
            url: pl.url,
            provider: pl.provider,
            amount: pl.amount,
            total: pl.total,
            status: pl.status,
          })),
        };
      });
    }
    return [];
  });
  const [calView, setCalView] = useState('week');
  const [calDate, setCalDate] = useState(new Date(TODAY));
  const [calSearch, setCalSearch] = useState('');
  const [selRes, setSelRes] = useState(null);
  const [resModal, setResModal] = useState(false);
  const [resF, setResF] = useState({paciente:'',email:'',telefono:'',fecha:'',hora:'',duracion:60,tipo:'',serviceId:'',notas:'',estado:'pendiente',pais:''});
  const [eResId, setEResId] = useState(null);

  const [metodos, setMetodos] = useState(() => {
    if (initialPaymentMethods && initialPaymentMethods.length > 0) {
      return initialPaymentMethods.map(m => ({
        id: m.id,
        tipo: m.tipo || 'Transferencia',
        nombre: m.nombre || '',
        banco: m.banco || '',
        titular: m.titular || '',
        cuentaVisible: m.cuenta_visible || '',
        cuentaCompleta: m.cuenta_completa || '',
        moneda: m.moneda || 'USD',
        tiempoConfirm: m.tiempo_confirm || '24 horas',
        instrucciones: m.instrucciones || '',
        notasInternas: m.notas_internas || '',
        correoProveedor: m.correo_proveedor || '',
        comision: m.comision || '',
        estadoConexion: m.estado_conexion || 'conectado',
        monedasAceptadas: m.monedas_aceptadas || 'USD',
        pagosRecurrentes: m.pagos_recurrentes || false,
        tipoCuenta: m.tipo_cuenta || 'Personal',
        tiempoAcredit: m.tiempo_acredit || 'Instantáneo',
        politicaReembolso: m.politica_reembolso || '',
        clavePublica: m.clave_publica || '',
        claveSecreta: m.clave_secreta || '',
        idComercio: m.id_comercio || '',
        activo: m.activo !== false,
        prioridad: m.prioridad || 1,
        recargoPct: m.recargo_pct || 0,
        color: m.color || '',
      }));
    }
    return [];
  });
  const [metModal, setMetModal] = useState(false);
  const [metF, setMetF] = useState({tipo:'Transferencia',nombre:'',banco:'',titular:'',cuentaVisible:'',cuentaCompleta:'',moneda:'USD',tiempoConfirm:'24 horas',instrucciones:'',notasInternas:'',correoProveedor:'',comision:'',estadoConexion:'conectado',monedasAceptadas:'USD',pagosRecurrentes:false,tipoCuenta:'Personal',tiempoAcredit:'Instantáneo',politicaReembolso:'',clavePublica:'',claveSecreta:'',idComercio:'',prioridad:1,recargoPct:0,color:''});
  const [eMetId, setEMetId] = useState(null);
  const [metViewId, setMetViewId] = useState(null);

  /* Invoice ops */
  const emptyInvF = {paciente:'',email:'',telefono:'',cedula:'',pais:'',direccion:'',concepto:'',monto:'',estado:'pendiente',metodoPago:'',link:'',bookingId:''};
  const saveInv = async () => {
    if (!invF.paciente || !invF.monto) { show('Paciente y monto son requeridos'); return; }
    if (!isValidName(invF.paciente)) { show('Nombre del paciente inválido'); return; }
    if (invF.email && !isValidEmail(invF.email)) { show('Email inválido'); return; }
    if (invF.telefono && !normalizePhone(invF.telefono)) { show('Teléfono inválido — incluye código de país (+1, +54)'); return; }
    if (!invF.concepto) { show('Selecciona un servicio o concepto'); return; }
    const _selSvc = services.find(s=>s.nombre===invF.concepto);
    if (_selSvc?.is_free) { show('No se puede crear comprobante para un servicio gratuito'); return; }
    // Validate: if not linked to booking, email is required for sending
    if (!invF.bookingId && !invF.email) { show('Email es requerido para comprobantes sin reserva'); return; }
    if (!invF.metodoPago) { show('Selecciona un método de pago'); return; }
    const _metCheck = metodos.find(m=>String(m.id)===String(invF.metodoPago));
    if (!_metCheck || !_metCheck.activo) { show('El método de pago seleccionado no existe o está inactivo'); return; }
    const _met = metodos.find(m=>String(m.id)===String(invF.metodoPago));
    const _pct = _met?.recargoPct || 0;
    const finalMonto = Math.round((_pct > 0 ? Number(invF.monto) * (1 + _pct / 100) : Number(invF.monto)) * 100) / 100;
    if (eInvId) {
      setInvoices(p => p.map(i => i.id === eInvId ? {...i,...invF,monto:finalMonto,booking_id:invF.bookingId||null} : i));
      show('Comprobante actualizado');
      setInvModal(false); setEInvId(null); setInvF(emptyInvF);
      try { await upsertInvoice({id: eInvId, paciente: invF.paciente, email: invF.email, telefono: invF.telefono, cedula: invF.cedula, pais: invF.pais, direccion: invF.direccion, concepto: invF.concepto, monto: finalMonto, estado: invF.estado, link: invF.link, booking_id: invF.bookingId || null}); } catch(e) { show('Error al guardar comprobante'); }
    } else {
      const newInv = {...invF,monto:finalMonto,fecha:new Date().toISOString().slice(0,10)};
      setInvModal(false);
      setConfirmModal(newInv);
    }
  };
  const confirmAndSend = async (em, wa) => {
    if (!confirmModal) return;
    try {
      const result = await upsertInvoice({paciente: confirmModal.paciente, email: confirmModal.email, telefono: confirmModal.telefono, cedula: confirmModal.cedula, pais: confirmModal.pais, direccion: confirmModal.direccion, concepto: confirmModal.concepto, monto: confirmModal.monto, estado: confirmModal.estado, link: confirmModal.link, booking_id: confirmModal.bookingId || null});
      const savedInv = {...confirmModal, id: result?.data?.id || Date.now(), booking_id: confirmModal.bookingId || null};
      setInvoices(p => [...p, savedInv]);
      const msgs = [];
      // Send email
      if (em && confirmModal.email) {
        try {
          const activeMets = metodos.filter(m => m.activo).map(m => ({ nombre: m.nombre, instrucciones: m.instrucciones }));
          await sendInvoiceNotification({ paciente: confirmModal.paciente, email: confirmModal.email, concepto: confirmModal.concepto, monto: Number(confirmModal.monto), estado: confirmModal.estado, fecha: confirmModal.fecha || new Date().toISOString().slice(0,10) }, activeMets);
          msgs.push('correo');
        } catch(e) { msgs.push('correo (error)'); }
      } else if (em && !confirmModal.email) { show('Comprobante creado. No se pudo enviar correo: falta email.'); setConfirmModal(null); setInvF(emptyInvF); return; }
      // Open WhatsApp
      if (wa && confirmModal.telefono) {
        const phone = confirmModal.telefono.replace(/[^0-9]/g, '');
        const text = encodeURIComponent(`Hola ${confirmModal.paciente}, te envío tu comprobante de pago:\n\nConcepto: ${confirmModal.concepto}\nMonto: $${Number(confirmModal.monto).toFixed(2)} USD\nEstado: ${confirmModal.estado}\n\n— Lda. Silvana López · Psicoterapia Online`);
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
        msgs.push('WhatsApp');
      } else if (wa && !confirmModal.telefono) { show('Comprobante creado. No se pudo enviar WhatsApp: falta teléfono.'); setConfirmModal(null); setInvF(emptyInvF); return; }
      show('Comprobante creado' + (msgs.length ? ' · Notificación enviada por ' + msgs.join(' y ') : ''));
    } catch(e) { show('Error al guardar comprobante'); }
    setConfirmModal(null); setInvF(emptyInvF);
  };
  const exportCSV = () => {
    const rows = [['ID','Paciente','Concepto','Monto','Estado','Fecha','Link']];
    const list = invFilter === 'todos' ? invoices : invoices.filter(i => i.estado === invFilter);
    list.forEach(i => rows.push([i.id,i.paciente,i.concepto,i.monto,i.estado,i.fecha,i.link]));
    const csv = rows.map(r => r.map(c => '"'+c+'"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='comprobantes_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    URL.revokeObjectURL(url); show('CSV exportado');
  };
  const dlInv = inv => {
    const html = makeInvHTML(inv,account,metodos);
    const blob = new Blob([html],{type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='comprobante_'+String(inv.id).padStart(4,'0')+'.html'; a.click();
    URL.revokeObjectURL(url); show('Comprobante descargado');
  };
  const prevInv = inv => {
    const html = makeInvHTML(inv,account,metodos);
    const w = window.open('','_blank');
    if(w){w.document.write(html);w.document.close()}
  };
  const copyLnk = link => { navigator.clipboard?.writeText(link); show('Link copiado'); };

  const fInvs = useMemo(() => {
    let filtered = invFilter === 'todos' ? invoices : invoices.filter(i => i.estado === invFilter);
    if (invSearch.trim()) {
      const q = invSearch.trim().toLowerCase();
      filtered = filtered.filter(i => String(i.id).includes(q) || (i.paciente||'').toLowerCase().includes(q) || (i.concepto||'').toLowerCase().includes(q));
    }
    return filtered;
  }, [invoices, invFilter, invSearch]);

  /* Reserva ops */
  const saveRes = async () => {
    if (!resF.paciente || !resF.fecha || !resF.hora) return;
    if (!isValidName(resF.paciente)) { show('Nombre del paciente inválido'); return; }
    if (resF.email && !isValidEmail(resF.email)) { show('Email inválido'); return; }
    if (resF.telefono && !normalizePhone(resF.telefono)) { show('Teléfono inválido — incluye código de país (+1, +54)'); return; }
    if (!resF.serviceId) { show('Selecciona un servicio'); return; }
    if (eResId) {
      setReservas(p => p.map(r => r.id === eResId ? {...r,...resF,duracion:Number(resF.duracion)} : r));
      show('Cita actualizada');
      try { await upsertBooking({id: eResId, paciente: resF.paciente, email: resF.email, telefono: resF.telefono, fecha: resF.fecha, hora: resF.hora, duracion: Number(resF.duracion), tipo: resF.tipo, notas: resF.notas, estado: resF.estado, pais: resF.pais, serviceId: resF.serviceId}); router.refresh(); } catch(e) { show('Error al guardar cita'); }
    } else {
      const nid = Math.max(0,...reservas.map(r=>r.id))+1;
      setReservas(p => [...p,{...resF,id:nid,duracion:Number(resF.duracion)}]);
      show('Cita creada');
      try { await upsertBooking({paciente: resF.paciente, email: resF.email, telefono: resF.telefono, fecha: resF.fecha, hora: resF.hora, duracion: Number(resF.duracion), tipo: resF.tipo, notas: resF.notas, estado: resF.estado, pais: resF.pais, serviceId: resF.serviceId}); router.refresh(); } catch(e) { show('Error al guardar cita'); }
    }
    setResModal(false); setEResId(null);
    setResF({paciente:'',email:'',telefono:'',fecha:'',hora:'',duracion:60,tipo:'',serviceId:'',notas:'',estado:'pendiente',pais:''});
  };
  const [deleteModal, setDeleteModal] = useState(null);
  const [deletePayLinks, setDeletePayLinks] = useState(false);
  const delRes = async id => {
    const booking = reservas.find(r => r.id === id);
    const links = booking?.paymentLinks || [];
    if (links.length > 0) {
      setDeletePayLinks(false);
      setDeleteModal({ id, links, paciente: booking.paciente });
      return;
    }
    if (!window.confirm('¿Desea eliminar esta cita?')) return;
    setReservas(p=>p.filter(r=>r.id!==id)); if(selRes?.id===id) setSelRes(null); show('Cita eliminada'); try { await deleteBooking(id, false); router.refresh(); } catch(e) { show('Error al eliminar cita'); }
  };
  const confirmDelRes = async () => {
    if (!deleteModal) return;
    const { id } = deleteModal;
    setReservas(p=>p.filter(r=>r.id!==id)); if(selRes?.id===id) setSelRes(null);
    setDeleteModal(null);
    show(deletePayLinks ? 'Cita y enlaces eliminados' : 'Cita eliminada');
    try { await deleteBooking(id, deletePayLinks); router.refresh(); } catch(e) { show('Error al eliminar cita'); }
  };

  /* Método ops */
  const saveMet = async () => {
    if (!metF.nombre || !metF.tipo) return;
    const editingId = eMetId;
    if (editingId) { setMetodos(p=>p.map(m=>m.id===editingId?{...m,...metF}:m)); show('Método actualizado'); }
    else { const nid=Math.max(0,...metodos.map(m=>m.id))+1; setMetodos(p=>[...p,{...metF,id:nid,activo:true,prioridad:p.length+1}]); show('Método agregado'); }
    setMetModal(false); setEMetId(null); setMetF({tipo:'Transferencia',nombre:'',banco:'',titular:'',cuentaVisible:'',cuentaCompleta:'',moneda:'USD',tiempoConfirm:'24 horas',instrucciones:'',notasInternas:'',correoProveedor:'',comision:'',estadoConexion:'conectado',monedasAceptadas:'USD',pagosRecurrentes:false,tipoCuenta:'Personal',tiempoAcredit:'Instantáneo',politicaReembolso:'',clavePublica:'',claveSecreta:'',idComercio:'',prioridad:1,recargoPct:0,color:''});
    try { const {id:_,...payload} = metF; const res = await upsertPaymentMethod({...payload, id: editingId || undefined}); if(res&&!res.success) show(res.error||'Error al guardar método'); else router.refresh(); } catch(e) { show('Error al guardar método'); }
  };

  /* Calendar */
  const ws = getMon(calDate);
  const wd = Array.from({length:7},(_,i)=>addD(ws,i));
  const md = useMemo(() => {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    const lastDay = new Date(y, m+1, 0).getDate();
    let startDow = new Date(y, m, 1).getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calDate]);
  const resDay = useCallback(ds => reservas.filter(r => r.fecha === ds), [reservas]);
  const navC = dir => {
    const d = new Date(calDate);
    if (calView === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCalDate(d);
  };

  const getVisibleRes = () => {
    if (calView === 'week') {
      const from = dkey(wd[0]), to = dkey(wd[6]);
      return reservas.filter(r => r.fecha >= from && r.fecha <= to);
    }
    if (calView === 'month') {
      const y = calDate.getFullYear(), m = String(calDate.getMonth()+1).padStart(2,'0');
      return reservas.filter(r => r.fecha && r.fecha.startsWith(y+'-'+m));
    }
    if (calSearch.trim()) {
      const q = calSearch.trim().toLowerCase();
      return reservas.filter(r => (r.id||'').slice(0,8).toLowerCase().includes(q) || (r.paciente||'').toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q));
    }
    return reservas;
  };

  const makeIcsEvent = (r) => {
    if (!r.fecha || !r.hora) return '';
    const start = r.fecha.replace(/-/g,'') + 'T' + r.hora.replace(':','') + '00';
    const [h,m] = r.hora.split(':').map(Number);
    const dur = Number(r.duracion) || 60;
    const endMin = h*60+m+dur;
    const end = r.fecha.replace(/-/g,'') + 'T' + String(Math.floor(endMin/60)).padStart(2,'0') + String(endMin%60).padStart(2,'0') + '00';
    return ['BEGIN:VEVENT','DTSTART:'+start,'DTEND:'+end,'SUMMARY:Sesión: '+r.paciente+' — '+r.tipo,'DESCRIPTION:Paciente: '+r.paciente+'\\nTipo: '+r.tipo+(r.email?'\\nEmail: '+r.email:'')+(r.telefono?'\\nTel: '+r.telefono:''),'LOCATION:Online','UID:'+r.id+'@silvana','END:VEVENT'].join('\r\n');
  };

  const exportIcs = () => {
    const visible = getVisibleRes().filter(r => r.fecha && r.hora);
    if (!visible.length) { show('No hay citas para exportar'); return; }
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Silvana Lopez//Dashboard//ES','X-WR-CALNAME:Citas — Lda. Silvana López',...visible.map(makeIcsEvent),'END:VCALENDAR'].join('\r\n');
    const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const label = calView === 'week' ? 'semana' : calView === 'month' ? 'mes' : 'todas';
    a.download = 'citas-silvana-'+label+'.ics'; a.click(); URL.revokeObjectURL(url);
    show(visible.length + ' cita(s) exportada(s)');
  };

  const exportGCal = () => {
    const visible = getVisibleRes().filter(r => r.fecha && r.hora);
    if (!visible.length) { show('No hay citas para exportar'); return; }
    if (visible.length > 10) {
      show('Más de 10 citas — descarga el .ics e impórtalo en Google Calendar');
      exportIcs(); return;
    }
    visible.forEach((r, i) => {
      setTimeout(() => {
        const start = r.fecha.replace(/-/g,'') + 'T' + r.hora.replace(':','') + '00';
        const [h,m] = r.hora.split(':').map(Number);
        const dur = Number(r.duracion) || 60;
        const endMin = h*60+m+dur;
        const end = r.fecha.replace(/-/g,'') + 'T' + String(Math.floor(endMin/60)).padStart(2,'0') + String(endMin%60).padStart(2,'0') + '00';
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Sesión: '+r.paciente+' — '+r.tipo)}&dates=${start}/${end}&details=${encodeURIComponent('Paciente: '+r.paciente+'\nTipo: '+r.tipo+(r.email?'\nEmail: '+r.email:'')+(r.telefono?'\nTel: '+r.telefono:''))}&location=Online`, '_blank');
      }, i * 600);
    });
    show(visible.length + ' cita(s) abierta(s) en Google Calendar');
  };

  const totalF = invoices.filter(i=>i.estado==='pagada').reduce((s,i)=>s+i.monto,0);
  const pend = invoices.filter(i=>i.estado==='pendiente').length;
  const citH = resDay(dkey(TODAY)).length;

  const navItems = [
    {key:'inicio',label:'Inicio',icon:I.home},
    {key:'cuenta',label:'Mi Cuenta',icon:I.user},
    {key:'facturas',label:'Comprobantes',icon:I.invoice},
    {key:'reservas',label:'Calendario',icon:I.calendar},
    {key:'disponibilidad',label:'Disponibilidad',icon:I.calendar},
    {key:'pagos',label:'Métodos de Pago',icon:I.credit},
    {key:'integraciones',label:'Integraciones',icon:I.gear},
    {key:'config',label:'Configuración',icon:I.gear},
  ];

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'DM Sans',sans-serif",background:darkMode?'#141414':'#fdfcfa',color:darkMode?'#e0e0e0':'#2a3528',transition:'background .3s, color .3s'}}>
      {/* SIDEBAR — Silvana brand */}
      <aside className={'psb' + (sidebarOpen ? ' open' : '')} style={{width:248,background:'#2a3528',color:'#c8ddc8',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,bottom:0,zIndex:900,transition:'transform .3s'}}>
        <div style={{padding:'22px 20px 16px',borderBottom:'1px solid rgba(200,221,200,.12)'}}>
          <div style={{display:'flex',alignItems:'center',gap:11}}>
            <img src={LOGO_SRC} alt="Logo" style={{width:36,height:36,objectFit:'contain',filter:'brightness(1.4)'}}/>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:15,color:'#f0f5f0',fontWeight:400}}>Lda. <span style={{fontStyle:'italic',color:'#c8ddc8'}}>Silvana López</span></div>
              <div style={{fontSize:9.5,color:'rgba(200,221,200,.45)',letterSpacing:'.12em',textTransform:'uppercase'}}>Psicoterapia Online</div>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:'12px 8px',display:'flex',flexDirection:'column',gap:1}}>
          {navItems.map(n => (
            <button key={n.key} onClick={() => {setSection(n.key);setSidebarOpen(false);setSelRes(null)}} style={{
              display:'flex',alignItems:'center',gap:11,width:'100%',padding:'10px 14px',borderRadius:10,border:'none',cursor:'pointer',
              background:section===n.key?'rgba(74,122,74,.2)':'transparent',color:section===n.key?'#c8ddc8':'rgba(200,221,200,.5)',
              fontWeight:section===n.key?500:300,fontSize:13.5,fontFamily:"'DM Sans',sans-serif",textAlign:'left'
            }}>{n.icon}{n.label}</button>
          ))}
        </nav>
        <div style={{padding:'12px 16px',borderTop:'1px solid rgba(200,221,200,.12)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#4a7a4a,#8fb08f)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'#fff'}}>SL</div>
          <div><div style={{fontSize:12,fontWeight:500,color:'#f0f5f0'}}>{nickname}</div><div style={{fontSize:10,color:'rgba(200,221,200,.4)'}}>{initialSettings?.especialidad || 'Psicóloga'}</div></div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="pmc" style={{flex:1,marginLeft:248,minHeight:'100vh',background:bgMain,transition:'background .3s'}}>
        <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 28px',borderBottom:'1px solid '+borderC,background:dm?'rgba(20,20,20,.95)':'rgba(253,252,250,.95)',backdropFilter:'blur(8px)',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <button className="pmb" onClick={()=>setSidebarOpen(!sidebarOpen)} style={{display:'none',border:'none',background:'none',cursor:'pointer',color:txSub,alignItems:'center',justifyContent:'center'}}>{I.menu}</button>
            <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:20,margin:0,color:txMain,fontWeight:400}}>{navItems.find(n=>n.key===section)?.label}</h1>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
          </div>
        </header>

        <div style={{padding:'22px 28px 40px',maxWidth:1180}}>

          {/* INICIO */}
          {section === 'inicio' && (
            <div style={{animation:'slideIn .3s'}}>
              <p style={{color:'#849884',margin:'0 0 22px',fontSize:14,fontWeight:300}}>Bienvenida, <strong style={{color:txMain,fontWeight:500}}>{nickname}</strong>. Resumen del consultorio.</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:14,marginBottom:26}}>
                {[
                  {l:'Cobrado',v:'$'+totalF.toLocaleString(),icon:I.dollar,g:'linear-gradient(135deg,#4a7a4a,#3a6a3a)'},
                  {l:'Pendientes',v:pend,icon:I.invoice,g:'linear-gradient(135deg,#c4956a,#b08050)'},
                  {l:'Citas hoy',v:citH,icon:I.calendar,g:'linear-gradient(135deg,#5a82b0,#3a6b9f)'},
                  {l:'Pacientes',v:reservas.length,icon:I.patients,g:'linear-gradient(135deg,#8fb08f,#6a9a6a)'},
                ].map((c,i) => (
                  <div key={i} style={{...CARD,padding:'18px 16px',display:'flex',alignItems:'center',gap:13,animation:'slideUp .3s ease '+(i*.05)+'s both'}}>
                    <div style={{width:42,height:42,borderRadius:12,background:c.g,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0}}>{c.icon}</div>
                    <div><div style={{fontSize:11,color:'#849884',fontWeight:400,marginBottom:1}}>{c.l}</div><div style={{fontSize:22,fontWeight:300,fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{c.v}</div></div>
                  </div>
                ))}
              </div>
              <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:16,marginBottom:10,fontWeight:400}}>Acciones rápidas</h3>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                <button onClick={()=>{setSection('facturas');setTimeout(()=>setInvModal(true),80)}} style={btnP}>{I.plus} Nuevo Comprobante</button>
                <button onClick={()=>{setSection('reservas');setTimeout(()=>setResModal(true),80)}} style={{...btnP,background:'linear-gradient(135deg,#5a82b0,#3a6b9f)'}}>{I.plus} Nueva Cita</button>
                <button onClick={()=>setSection('config')} style={btnS}>{I.gear} Configuración</button>
              </div>
            </div>
          )}

          {/* CUENTA */}
          {section === 'cuenta' && (
            <div style={{animation:'slideIn .3s',display:'grid',gap:16}}>
              {/* Profile card */}
              <div style={{...CARD,padding:26}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:54,height:54,borderRadius:14,background:'linear-gradient(135deg,#4a7a4a,#8fb08f)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                      <img src={LOGO_SRC} alt="Logo" style={{width:34,height:34,objectFit:'contain',filter:'brightness(2.5)'}}/>
                    </div>
                    <div><h2 style={{margin:0,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:20,fontWeight:400}}>{account.nombre}</h2><p style={{margin:0,color:'#849884',fontSize:13,fontWeight:300}}>{account.especialidad}</p></div>
                  </div>
                  <button onClick={()=>{setEditAcc(true);setAccF({...account})}} style={btnP}>{I.edit} Editar</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px 26px'}}>
                  {[['Email',account.email],['Teléfono',account.telefono],['Dirección',account.direccion],['Cédula',account.cedula]].map(([l,v],i) => (
                    <div key={i}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:400}}>{v}</div></div>
                  ))}
                </div>
                <div style={{marginTop:16}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>Horario de atención</div>
                  <div style={{fontSize:13,color:'#4e6050',fontWeight:300}}>
                    {formatWorkingHours(workingHours) || <span style={{fontStyle:'italic',color:'#849884'}}>Sin horario configurado</span>}
                    <button onClick={()=>setSection('disponibilidad')} style={{marginLeft:10,border:'none',background:'transparent',color:'#4a7a4a',fontSize:11,cursor:'pointer',textDecoration:'underline'}}>Gestionar en Disponibilidad →</button>
                  </div>
                </div>
                <div style={{marginTop:16}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>Biografía</div><div style={{fontSize:13,color:'#4e6050',lineHeight:1.6,fontWeight:300}}>{account.bio}</div></div>
              </div>

              {/* Services */}
              <div style={{...CARD,padding:26}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:0,fontWeight:400,display:'flex',alignItems:'center',gap:8}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                    Servicios ofrecidos
                  </h3>
                  <button onClick={()=>{setESvcId(null);setSvcF({nombre:'',descripcion:'',color:'#8fb08f',duracion:50,precioTipo:'oculto',precio:'',modalidad:'Online · Videollamada',features:'',tag:'',typeLabel:'',subtitle:''});setSvcModal(true)}} style={{...btnP,fontSize:12,padding:'7px 15px'}}>{I.plus} Nuevo</button>
                </div>
                <div style={{display:'grid',gap:10}}>
                  {services.map(svc => (
                    <div key={svc.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:12,border:'1px solid '+(dm?'#333':'#e2ede2'),gap:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:svc.color,flexShrink:0}}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:500}}>{svc.nombre}</div>
                          <div style={{fontSize:12,color:'#849884',fontWeight:300,display:'flex',gap:8,flexWrap:'wrap',marginTop:2}}>
                            <span>{svc.duracion || 50} min</span>
                            <span>{svc.precioTipo==='gratis'?'Gratis':svc.precioTipo==='precio'?'$'+svc.precio+' USD':'Precio oculto'}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                        <button onClick={async ()=>{const nv=!(svc.active!==false);setServices(p=>p.map(s=>s.id===svc.id?{...s,active:nv}:s));try{await toggleServiceActive(svc.id,nv)}catch(e){show('Error al cambiar estado')};show(nv?'Servicio activado':'Servicio desactivado')}} style={{width:36,height:20,borderRadius:10,border:'none',background:svc.active!==false?'#4a7a4a':'#c8ddc8',cursor:'pointer',position:'relative',transition:'background .3s'}}><div style={{width:14,height:14,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:svc.active!==false?19:3,transition:'left .3s',boxShadow:'0 1px 3px rgba(0,0,0,.15)'}}/></button>
                        <button onClick={()=>{setESvcId(svc.id);setSvcF({nombre:svc.nombre,descripcion:svc.descripcion,color:svc.color,duracion:svc.duracion||50,precioTipo:svc.precioTipo||'oculto',precio:svc.precio||'',modalidad:svc.modalidad||'Online · Videollamada',features:svc.features||'',tag:svc.tag||'',typeLabel:svc.typeLabel||'',subtitle:svc.subtitle||''});setSvcModal(true)}} style={{border:'none',background:'#e2ede2',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.edit}</button>
                        <button onClick={async ()=>{setServices(p=>p.filter(s=>s.id!==svc.id));show('Servicio eliminado');try{await deleteService(svc.id)}catch(e){show('Error al eliminar servicio')}}} style={{border:'none',background:'#FFEBEE',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                      </div>
                    </div>
                  ))}
                  {services.length === 0 && <p style={{color:'#849884',fontSize:13,textAlign:'center',padding:20}}>No hay servicios configurados</p>}
                </div>
              </div>

              {/* Edit Account Modal */}
              <Modal dark={dm} open={editAcc} onClose={()=>setEditAcc(false)} title="Editar Cuenta" width={600}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Nombre"><input style={inp} value={accF.nombre} onChange={e=>setAccF({...accF,nombre:e.target.value})}/></Field>
                  <Field label="Especialidad"><input style={inp} value={accF.especialidad} onChange={e=>setAccF({...accF,especialidad:e.target.value})}/></Field>
                  <Field label="Email"><input style={inp} value={accF.email} onChange={e=>setAccF({...accF,email:e.target.value})}/></Field>
                  <Field label="Teléfono"><input style={inp} value={accF.telefono} onChange={e=>setAccF({...accF,telefono:sanitizePhoneInput(e.target.value)})} maxLength={22} placeholder="+1 000 000 0000"/></Field>
                  <Field label="Cédula"><input style={inp} value={accF.cedula} onChange={e=>setAccF({...accF,cedula:e.target.value})}/></Field>
                </div>
                <Field label="Dirección"><input style={inp} value={accF.direccion} onChange={e=>setAccF({...accF,direccion:e.target.value})}/></Field>
                <Field label="Biografía"><textarea style={{...inp,minHeight:70,resize:'vertical'}} value={accF.bio} onChange={e=>setAccF({...accF,bio:e.target.value})}/></Field>
                <div style={{background:'#f0f5f0',border:'1px solid #c8ddc8',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#4a7a4a',marginBottom:8}}>
                  El horario laboral y las excepciones se gestionan ahora en <strong>Disponibilidad</strong>.
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
                  <button onClick={()=>setEditAcc(false)} style={btnS}>Cancelar</button>
                  <button onClick={async ()=>{
                    setAccount({...accF});setEditAcc(false);show('Cuenta actualizada');
                    try{await updateProfile({...accF, working_hours: workingHours})}catch(e){show('Error al guardar cuenta')}
                  }} style={btnP}>{I.check} Guardar</button>
                </div>
              </Modal>

              {/* Service Modal */}
              <Modal dark={dm} open={svcModal} onClose={()=>{setSvcModal(false);setESvcId(null)}} title={eSvcId?'Editar Servicio':'Nuevo Servicio'} width={560}>
                <Field label="Nombre del servicio"><input style={inp} value={svcF.nombre} onChange={e=>setSvcF({...svcF,nombre:e.target.value})} placeholder="Ej: Cita Gratuita, Sesión de pareja..."/></Field>
                <Field label="Subtítulo (opcional)"><input style={inp} value={svcF.subtitle} onChange={e=>setSvcF({...svcF,subtitle:e.target.value})} placeholder="Ej: Sin cargo · Sin compromiso"/></Field>
                <Field label="Descripción"><textarea style={{...inp,minHeight:60,resize:'vertical'}} value={svcF.descripcion} onChange={e=>setSvcF({...svcF,descripcion:e.target.value})} placeholder="Breve descripción del servicio"/></Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Duración (minutos)"><input type="number" min="10" step="5" style={inp} value={svcF.duracion} onChange={e=>setSvcF({...svcF,duracion:Number(e.target.value)||50})}/></Field>
                  <Field label="Modalidad"><input style={inp} value={svcF.modalidad} onChange={e=>setSvcF({...svcF,modalidad:e.target.value})} placeholder="Online · Videollamada"/></Field>
                </div>
                <Field label="Precio">
                  <div style={{display:'flex',gap:6,marginBottom:8}}>
                    {[{v:'gratis',l:'Gratuito'},{v:'precio',l:'Con precio'},{v:'oculto',l:'Ocultar precio'}].map(o=>(
                      <button key={o.v} onClick={()=>setSvcF({...svcF,precioTipo:o.v})} style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",borderColor:svcF.precioTipo===o.v?'#4a7a4a':'#c8ddc8',background:svcF.precioTipo===o.v?'#f0f5f0':'transparent',color:svcF.precioTipo===o.v?'#4a7a4a':'#849884',fontWeight:svcF.precioTipo===o.v?500:400}}>{o.l}</button>
                    ))}
                  </div>
                  {svcF.precioTipo==='precio' && (
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:14,color:'#849884'}}>$</span>
                      <input type="number" min="0" step="1" style={{...inp,width:100,marginBottom:0}} value={svcF.precio} onChange={e=>setSvcF({...svcF,precio:e.target.value})} placeholder="45"/>
                      <span style={{fontSize:12,color:'#849884'}}>USD</span>
                    </div>
                  )}
                  {svcF.precioTipo==='oculto' && <p style={{fontSize:11,color:'#849884',margin:'2px 0 0',fontStyle:'italic'}}>El precio no se mostrará en la página pública</p>}
                </Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Etiqueta (opcional)"><input style={inp} value={svcF.tag} onChange={e=>setSvcF({...svcF,tag:e.target.value})} placeholder="Ej: Consulta inicial"/></Field>
                  <Field label="Tipo (opcional)"><input style={inp} value={svcF.typeLabel} onChange={e=>setSvcF({...svcF,typeLabel:e.target.value})} placeholder="Ej: Proceso continuo"/></Field>
                </div>
                <Field label="Características (una por línea)"><textarea style={{...inp,minHeight:80,resize:'vertical',fontSize:12,lineHeight:1.6}} value={svcF.features} onChange={e=>setSvcF({...svcF,features:e.target.value})} placeholder={"Sesión personalizada de 50 minutos\nEnfoque integrativo\nPlan terapéutico a medida"}/></Field>
                <Field label="Color identificador">
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {['#4a7a4a','#5a82b0','#8fb08f','#c4956a','#8b5a8b','#b04a4a','#4a6a8b','#6a8b4a'].map(c => (
                      <button key={c} onClick={()=>setSvcF({...svcF,color:c})} style={{width:32,height:32,borderRadius:8,background:c,border:svcF.color===c?'3px solid #2a3528':'2px solid #e2ede2',cursor:'pointer'}}/>
                    ))}
                  </div>
                </Field>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
                  <button onClick={()=>{setSvcModal(false);setESvcId(null)}} style={btnS}>Cancelar</button>
                  <button onClick={async ()=>{
                    if(!svcF.nombre) return;
                    const svcData = {nombre:svcF.nombre,descripcion:svcF.descripcion,color:svcF.color,duracion:svcF.duracion,precio:svcF.precioTipo==='precio'?svcF.precio:null,is_free:svcF.precioTipo==='gratis',modalidad:svcF.modalidad,features:svcF.features.split('\n').map(f=>f.trim()).filter(Boolean),tag:svcF.tag,typeLabel:svcF.typeLabel,subtitle:svcF.subtitle};
                    if(eSvcId){setServices(p=>p.map(s=>s.id===eSvcId?{...s,...svcF}:s));show('Servicio actualizado');try{await upsertService({id:eSvcId,...svcData})}catch(e){show('Error al guardar servicio')}}
                    else{const nid=Math.max(0,...services.map(s=>s.id))+1;setServices(p=>[...p,{...svcF,id:nid,active:true}]);show('Servicio creado');try{await upsertService(svcData)}catch(e){show('Error al guardar servicio')}}
                    setSvcModal(false);setESvcId(null);
                  }} style={btnP}>{I.check} {eSvcId?'Actualizar':'Crear'}</button>
                </div>
              </Modal>
            </div>
          )}

          {/* COMPROBANTES */}
          {section === 'facturas' && (
            <div style={{animation:'slideIn .3s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  {['todos','pendiente','pagada','vencida'].map(f => (
                    <button key={f} onClick={()=>setInvFilter(f)} style={{padding:'6px 15px',borderRadius:20,border:'1.5px solid',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",borderColor:invFilter===f?'#4a7a4a':'#c8ddc8',background:invFilter===f?'#f0f5f0':'#fdfcfa',color:invFilter===f?'#4a7a4a':'#4e6050',textTransform:'capitalize'}}>{f}</button>
                  ))}
                  <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Buscar por ID, paciente..." style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid #c8ddc8',fontSize:12,fontFamily:"'DM Sans',sans-serif",background:'#fdfcfa',color:'#2a3528',outline:'none',width:200,marginLeft:6}} />
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={exportCSV} style={{...btnS,fontSize:12,padding:'7px 15px'}}>{I.download} CSV</button>
                  <button onClick={()=>{if(!metodos.some(m=>m.activo)){show('Configura al menos un método de pago activo');return;}setEInvId(null);setInvF(emptyInvF);setInvModal(true)}} style={{...btnP,fontSize:12,padding:'7px 15px'}}>{I.plus} Nuevo</button>
                </div>
              </div>
              <div style={{...CARD,overflow:'hidden'}}>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead><tr style={{borderBottom:'2px solid '+(dm?'#333':'#e2ede2')}}>
                      {['ID','Paciente','Concepto','Monto','Estado','Fecha',''].map(h => (
                        <th key={h} style={{padding:'11px 13px',textAlign:'left',fontSize:10,fontWeight:500,color:'#849884',textTransform:'uppercase',letterSpacing:'.5px',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {fInvs.map((inv, idx) => (
                        <tr key={inv.id} style={{borderBottom:'1px solid '+(dm?'#2a2a2a':'#f0f5f0')}} onMouseEnter={e=>e.currentTarget.style.background=(dm?'#252525':'#f0f5f0')} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{padding:'11px 13px',color:'#849884',fontSize:12,fontFamily:'monospace'}}>{inv.id}</td>
                          <td style={{padding:'11px 13px',fontWeight:500}}>{inv.paciente}</td>
                          <td style={{padding:'11px 13px',color:'#4e6050'}}>{inv.concepto}</td>
                          <td style={{padding:'11px 13px',fontWeight:500}}>{'$'+inv.monto.toLocaleString()}</td>
                          <td style={{padding:'11px 13px'}}><span style={bdg(inv.estado==='pagada'?'green':inv.estado==='pendiente'?'yellow':'red')}>{inv.estado}</span></td>
                          <td style={{padding:'11px 13px',color:'#849884',whiteSpace:'nowrap',fontSize:12}}>{inv.fecha}</td>
                          <td style={{padding:'11px 13px',position:'relative'}}>
                            <div style={{display:'flex',gap:5}}>
                              <button title="Ver" onClick={()=>prevInv(inv)} style={{border:'none',background:'#f0f5f0',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.eye}</button>
                              <button title="Descargar" onClick={()=>dlInv(inv)} style={{border:'none',background:'#f0f5f0',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.download}</button>
                              <button title="Editar" onClick={()=>{setEInvId(inv.id);setInvF({paciente:inv.paciente,email:inv.email||'',telefono:inv.telefono||'',cedula:inv.cedula||'',pais:inv.pais||'',direccion:inv.direccion||'',concepto:inv.concepto,monto:String(Math.round(Number(inv.monto)*100)/100),estado:inv.estado,metodoPago:'',link:inv.link||'',bookingId:inv.booking_id||''});setInvModal(true)}} style={{border:'none',background:'#e2ede2',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.edit}</button>
                              <button title="Eliminar" onClick={()=>{
                                // Check if invoice link matches any booking's payment link
                                if (inv.link) {
                                  const linkedBooking = reservas.find(r => (r.paymentLinks || []).some(pl => pl.url === inv.link));
                                  if (linkedBooking) {
                                    window.alert(`Este enlace de pago está asociado a la cita de "${linkedBooking.paciente}" (${linkedBooking.fecha}).\n\nDebes desvincular el enlace de la cita primero antes de eliminar este comprobante.`);
                                    return;
                                  }
                                }
                                setDelInvConfirm(inv);
                              }} style={{border:'none',background:'#FFEBEE',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {fInvs.length === 0 && <div style={{padding:36,textAlign:'center',color:'#849884',fontSize:14}}>No se encontraron comprobantes</div>}
              </div>

              {/* Delete confirmation modal */}
              <Modal dark={dm} open={!!delInvConfirm} onClose={()=>setDelInvConfirm(null)} title="Confirmar eliminación" width={420} zIndex={1020}>
                <div style={{textAlign:'center',padding:'10px 0 20px'}}>
                  <div style={{width:48,height:48,borderRadius:'50%',background:'#FFEBEE',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',color:'#C62828'}}>{I.trash}</div>
                  <p style={{fontSize:14,color:dm?'#e0e0e0':'#2a3528',marginBottom:6}}>¿Estás segura de eliminar este comprobante?</p>
                  {delInvConfirm && <p style={{fontSize:12,color:'#849884',margin:0}}>#{delInvConfirm.id} — {delInvConfirm.paciente} · {delInvConfirm.concepto} · ${Number(delInvConfirm.monto).toFixed(2)}</p>}
                  <p style={{fontSize:11,color:'#C62828',marginTop:10,fontStyle:'italic'}}>Esta acción no se puede deshacer.</p>
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                  <button onClick={()=>setDelInvConfirm(null)} style={btnS}>Cancelar</button>
                  <button onClick={async ()=>{if(!delInvConfirm)return;const id=delInvConfirm.id;setDelInvConfirm(null);setInvoices(p=>p.filter(i=>i.id!==id));show('Comprobante eliminado');try{await deleteInvoice(id)}catch(e){show('Error al eliminar')}}} style={{...btnP,background:'#C62828'}}>Eliminar</button>
                </div>
              </Modal>

              <Modal dark={dm} open={invModal} onClose={()=>{setInvModal(false);setEInvId(null)}} title={eInvId?'Editar Comprobante':'Nuevo Comprobante de Pago'} width={540} zIndex={1010}>
                {/* ID (read-only) */}
                {eInvId && <div style={{marginBottom:12,padding:'8px 14px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2')}}><span style={{fontSize:10,color:'#849884',textTransform:'uppercase',letterSpacing:'.5px',fontWeight:500}}>ID del comprobante</span><div style={{fontSize:14,fontFamily:'monospace',color:dm?'#e0e0e0':'#2a3528',marginTop:2}}>{eInvId}</div></div>}
                {/* Booking association */}
                <Field label="Asociar a reserva">
                  <select style={sel} value={invF.bookingId} onChange={e=>{
                    const bid = e.target.value;
                    if (bid) {
                      const bk = reservas.find(r=>r.id===bid);
                      if (bk) {
                        const svc = services.find(s=>s.nombre===bk.tipo);
                        setInvF({...invF, bookingId:bid, paciente:bk.paciente, email:bk.email, telefono:bk.telefono, pais:bk.pais, concepto: svc ? svc.nombre : '', monto: svc && svc.precio && !svc.is_free ? svc.precio : ''});
                      }
                    } else {
                      setInvF({...invF, bookingId:''});
                    }
                  }}>
                    <option value="">Sin reserva (independiente)</option>
                    {reservas.map(r => <option key={r.id} value={r.id}>{r.paciente} — {r.fecha} {r.hora}</option>)}
                  </select>
                </Field>

                <Field label="Paciente"><input style={inp} value={invF.paciente} onChange={e=>setInvF({...invF,paciente:sanitizeName(e.target.value)})} maxLength={80} placeholder="Nombre del paciente"/></Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Email"><input style={inp} type="email" value={invF.email} onChange={e=>setInvF({...invF,email:e.target.value})} placeholder="correo@mail.com"/></Field>
                  <Field label="WhatsApp / Teléfono"><input style={inp} value={invF.telefono} onChange={e=>setInvF({...invF,telefono:sanitizePhoneInput(e.target.value)})} maxLength={22} placeholder="+1 000 000 0000"/></Field>
                </div>
                {!invF.bookingId && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 14px'}}>
                    <Field label="Cédula / DNI"><input style={inp} value={invF.cedula} onChange={e=>setInvF({...invF,cedula:e.target.value})} placeholder="00000000"/></Field>
                    <Field label="Ubicación"><select style={sel} value={invF.pais} onChange={e=>setInvF({...invF,pais:e.target.value})}>{UBICACIONES.map(p=><option key={p} value={p}>{p||'— Sin ubicación —'}</option>)}</select></Field>
                    <Field label="Dirección"><input style={inp} value={invF.direccion} onChange={e=>setInvF({...invF,direccion:e.target.value})} placeholder="Ciudad, Estado"/></Field>
                  </div>
                )}

                <div style={{marginTop:4,marginBottom:4,height:1,background:dm?'#333':'#e2ede2'}} />

                {(() => {
                  const selectedSvc = services.find(s=>s.nombre===invF.concepto);
                  const isFreeService = selectedSvc?.is_free === true;
                  const selMet = metodos.find(m=>String(m.id)===String(invF.metodoPago));
                  const surchargePct = selMet?.recargoPct || 0;
                  const hasSurcharge = surchargePct > 0;
                  const baseAmount = Number(invF.monto) || 0;
                  const surchargeAmount = hasSurcharge ? baseAmount * (surchargePct / 100) : 0;
                  const totalAmount = baseAmount + surchargeAmount;
                  return (<>
                <Field label="Concepto"><select style={sel} value={invF.concepto} onChange={e=>{const name=e.target.value;const svc=services.find(s=>s.nombre===name);setInvF({...invF,concepto:name,monto:svc&&svc.precio&&!svc.is_free?svc.precio:''});}}><option value="">Seleccionar servicio...</option>{services.filter(s=>s.active!==false).map(s=>(<option key={s.id} value={s.nombre}>{s.nombre}{s.is_free?' (Gratis)':s.precio?' — $'+s.precio+' USD':''}</option>))}<option value="Otro">Otro</option></select></Field>
                {isFreeService && (
                  <div style={{background:'#FFF8E1',borderRadius:10,padding:'11px 14px',fontSize:12,color:'#b08050',border:'1px solid #ffe0b2',marginTop:4}}>Este servicio es gratuito. No se puede crear comprobante ni enlace de pago.</div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Monto (USD)"><input style={inp} type="number" value={invF.monto} onChange={e=>setInvF({...invF,monto:e.target.value})} placeholder="0.00" disabled={isFreeService}/></Field>
                  <Field label="Estado"><select style={sel} value={invF.estado} onChange={e=>setInvF({...invF,estado:e.target.value})}><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="vencida">Vencida</option><option value="cancelada">Cancelada</option></select></Field>
                </div>
                {!isFreeService && (
                  <Field label="Método de pago">{metodos.filter(m=>m.activo).length > 0 ? (
                    <select style={sel} value={invF.metodoPago||''} onChange={e=>setInvF({...invF,metodoPago:e.target.value})}><option value="">Seleccionar método...</option>{metodos.filter(m=>m.activo).map(m=>(<option key={m.id} value={m.id}>{m.nombre}</option>))}</select>
                  ) : (
                    <div style={{background:'#FFF8E1',borderRadius:10,padding:'11px 14px',fontSize:12,color:'#b08050',border:'1px solid #ffe0b2'}}>No hay métodos de pago activos. Configura uno en Métodos de pago.</div>
                  )}</Field>
                )}
                {hasSurcharge && baseAmount > 0 && (
                  <div style={{background:'#f0f7f0',border:'1px solid #c8dcc8',borderRadius:12,padding:'12px 14px',marginBottom:4}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#4e6050',marginBottom:4}}><span>Monto base</span><span>${baseAmount.toFixed(2)}</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#b08050',marginBottom:4}}><span>Recargo {selMet?.nombre} ({surchargePct}%)</span><span>+${surchargeAmount.toFixed(2)}</span></div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:600,color:'#2a3528',borderTop:'1px solid #c8dcc8',paddingTop:6}}><span>Total</span><span>${totalAmount.toFixed(2)}</span></div>
                  </div>
                )}
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>{setInvModal(false);setEInvId(null);setInvF(emptyInvF)}} style={btnS}>Cancelar</button>
                  <button onClick={saveInv} style={{...btnP,...(isFreeService?{opacity:0.5,cursor:'not-allowed'}:{})}} disabled={isFreeService}>{I.check} {eInvId ? 'Actualizar' : 'Continuar'}</button>
                </div>
                  </>);
                })()}
              </Modal>

              <Modal dark={dm} open={!!confirmModal} onClose={()=>setConfirmModal(null)} title="Enviar notificación" width={460} zIndex={1020}>
                {confirmModal && (
                  <>
                    <div style={{...CARD,padding:16,marginBottom:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{fontWeight:500}}>{confirmModal.paciente}</span>
                        <span style={{fontWeight:500,color:'#4a7a4a'}}>{'$'+confirmModal.monto?.toLocaleString()+' USD'}</span>
                      </div>
                      <div style={{fontSize:12,color:'#849884'}}>{confirmModal.concepto}</div>
                      <div style={{fontSize:11,color:'#4a7a4a',marginTop:6,display:'flex',alignItems:'center',gap:6}}>{I.link} {confirmModal.link}</div>
                    </div>
                    <p style={{fontSize:13,color:'#4e6050',margin:'0 0 14px'}}>Selecciona cómo notificar al paciente sobre este comprobante.</p>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      <button onClick={()=>confirmAndSend(true,true)} style={{...btnP,justifyContent:'center',width:'100%'}}>{I.mail} {I.msg} Enviar correo y WhatsApp</button>
                      <div style={{display:'flex',gap:10}}>
                        <button onClick={()=>confirmAndSend(true,false)} style={{...btnS,flex:1,justifyContent:'center'}}>{I.mail} Solo correo</button>
                        <button onClick={()=>confirmAndSend(false,true)} style={{...btnS,flex:1,justifyContent:'center'}}>{I.msg} Solo WhatsApp</button>
                      </div>
                      <button onClick={()=>confirmAndSend(false,false)} style={{border:'none',background:'none',color:'#849884',fontSize:12,cursor:'pointer',padding:'6px',fontFamily:"'DM Sans',sans-serif"}}>Omitir y solo guardar</button>
                    </div>
                  </>
                )}
              </Modal>
            </div>
          )}

          {/* CALENDARIO */}
          {section === 'reservas' && (
            <div style={{animation:'slideIn .3s',display:'flex',gap:0,minHeight:'calc(100vh - 130px)'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={()=>navC(-1)} style={{border:'none',background:'#f0f5f0',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4e6050',border:'1px solid #e2ede2'}}>{I.chevL}</button>
                    <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:18,margin:0,minWidth:200,textAlign:'center',fontWeight:400}}>
                      {calView === 'week'
                        ? wd[0].getDate() + ' – ' + wd[6].getDate() + ' ' + MESES[wd[6].getMonth()] + ' ' + wd[6].getFullYear()
                        : MESES[calDate.getMonth()] + ' ' + calDate.getFullYear()
                      }
                    </h2>
                    <button onClick={()=>navC(1)} style={{border:'none',background:'#f0f5f0',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4e6050',border:'1px solid #e2ede2'}}>{I.chevR}</button>
                    <button onClick={()=>setCalDate(new Date(TODAY))} style={{...btnS,fontSize:11,padding:'5px 12px'}}>Hoy</button>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    {['week','month','list'].map(v => (
                      <button key={v} onClick={()=>setCalView(v)} style={{padding:'6px 14px',borderRadius:8,border:'1.5px solid',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",borderColor:calView===v?'#4a7a4a':'#c8ddc8',background:calView===v?'#f0f5f0':'#fdfcfa',color:calView===v?'#4a7a4a':'#4e6050'}}>{v === 'week' ? 'Semana' : v === 'month' ? 'Mes' : 'Lista'}</button>
                    ))}
                    <button onClick={exportGCal} style={{...btnS,fontSize:11,padding:'5px 10px'}} title="Agregar citas visibles a Google Calendar">{I.calendar} Google</button>
                    <button onClick={exportIcs} style={{...btnS,fontSize:11,padding:'5px 10px'}} title="Descargar citas visibles como archivo .ics">{I.download} .ics</button>
                    <button onClick={()=>{setEResId(null);setResF({paciente:'',email:'',telefono:'',fecha:'',hora:'',duracion:60,tipo:'',serviceId:'',notas:'',estado:'pendiente',pais:''});setResModal(true)}} style={{...btnP,fontSize:12,padding:'6px 13px',marginLeft:4}}>{I.plus} Cita</button>
                  </div>
                </div>

                {calView === 'week' && (
                  <div style={{...CARD,overflow:'hidden'}}>
                    <div style={{display:'grid',gridTemplateColumns:'54px repeat(7,1fr)',borderBottom:'2px solid '+(dm?'#333':'#c8d8c8')}}>
                      <div style={{padding:8,borderRight:'1px solid '+(dm?'#2a2a2a':'#d4ddd4')}}/>
                      {wd.map((d,i) => {
                        const t = sameD(d, TODAY);
                        return (
                          <div key={i} style={{padding:'8px 4px',textAlign:'center',borderRight:i<6?'1px solid '+(dm?'#2a2a2a':'#d4ddd4'):'none',background:t?(dm?'#1a2e1f':'#f0f5f0'):'transparent'}}>
                            <div style={{fontSize:10,fontWeight:500,color:'#849884',textTransform:'uppercase'}}>{DIAS_ES[i]}</div>
                            <div style={{fontSize:17,fontWeight:t?500:400,fontFamily:"'Cormorant Garamond',Georgia,serif",color:t?'#4a7a4a':'#2a3528',marginTop:1}}>{d.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{maxHeight:500,overflowY:'auto'}}>
                      {HORAS.map(hora => (
                        <div key={hora} style={{display:'grid',gridTemplateColumns:'54px repeat(7,1fr)',minHeight:50,borderBottom:'1px solid '+(dm?'#2a2a2a':'#d4ddd4')}}>
                          <div style={{padding:'4px 5px 0',textAlign:'right',fontSize:10,color:'#a0b5a0',fontWeight:400,borderRight:'1px solid '+(dm?'#2a2a2a':'#d4ddd4')}}>{hora}</div>
                          {wd.map((d, di) => {
                            const dk2 = dkey(d);
                            const evs = resDay(dk2).filter(r => r.hora === hora);
                            const t = sameD(d, TODAY);
                            return (
                              <div key={di} onClick={() => {if(!evs.length){setEResId(null);setResF({paciente:'',email:'',telefono:'',fecha:dk2,hora:hora,duracion:60,tipo:'',serviceId:'',notas:'',estado:'pendiente',pais:''});setResModal(true)}}}
                                style={{padding:'2px 3px',borderRight:di<6?'1px solid '+(dm?'#2a2a2a':'#d4ddd4'):'none',background:t?(dm?'rgba(74,122,74,.08)':'rgba(240,245,240,.5)'):'transparent',cursor:evs.length?'default':'pointer',minHeight:50}}>
                                {evs.map(ev => {
                                  const tc = TC[ev.tipo] || TC.Individual;
                                  return (
                                    <div key={ev.id} onClick={e => {e.stopPropagation();setSelRes(ev)}} style={{
                                      background:tc.bg,borderLeft:'3px solid '+tc.dot,borderRadius:5,padding:'3px 6px',cursor:'pointer',
                                      marginBottom:2,boxShadow:selRes?.id===ev.id?'0 0 0 2px '+tc.dot:'none',transition:'box-shadow .15s'
                                    }}>
                                      <div style={{fontSize:11,fontWeight:500,color:tc.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ev.paciente}</div>
                                      <div style={{fontSize:9,color:tc.text,opacity:.65}}>{ev.tipo} · {ev.duracion}m</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {calView === 'month' && (
                  <div style={{...CARD,overflow:'hidden'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'2px solid '+(dm?'#333':'#c8d8c8')}}>
                      {DIAS_ES.map(d => <div key={d} style={{padding:8,textAlign:'center',fontSize:10,fontWeight:500,color:'#849884',textTransform:'uppercase'}}>{d}</div>)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
                      {md.map((d, i) => {
                        if (d === null) return <div key={'e'+i} style={{minHeight:74,borderBottom:'1px solid '+(dm?'#2a2a2a':'#d4ddd4'),borderRight:i%7<6?'1px solid '+(dm?'#2a2a2a':'#d4ddd4'):'none',background:dm?'#1a1a1a':'#f7faf7'}}/>;
                        const dk2 = dkey(d);
                        const evs = resDay(dk2);
                        const t = sameD(d, TODAY);
                        return (
                          <div key={'d'+i} onClick={() => {if(!evs.length){setEResId(null);setResF({paciente:'',email:'',telefono:'',fecha:dk2,hora:'09:00',duracion:60,tipo:'',serviceId:'',notas:'',estado:'pendiente',pais:''});setResModal(true)}}}
                            style={{minHeight:74,padding:'3px 4px',borderBottom:'1px solid '+(dm?'#2a2a2a':'#d4ddd4'),borderRight:i%7<6?'1px solid '+(dm?'#2a2a2a':'#d4ddd4'):'none',background:t?(dm?'#1a2e1f':'#f0f5f0'):'transparent',cursor:'pointer'}}>
                            <div style={{fontSize:11,fontWeight:t?500:400,color:t?'#4a7a4a':'#4e6050',marginBottom:2}}>{d.getDate()}</div>
                            {evs.slice(0,2).map(ev => {
                              const tc = TC[ev.tipo] || TC.Individual;
                              return (
                                <div key={ev.id} onClick={e => {e.stopPropagation();setSelRes(ev)}} style={{
                                  background:tc.bg,borderRadius:3,padding:'1px 4px',marginBottom:1,cursor:'pointer',
                                  borderLeft:'2px solid '+tc.dot,boxShadow:selRes?.id===ev.id?'0 0 0 1.5px '+tc.dot:'none'
                                }}>
                                  <div style={{fontSize:9.5,fontWeight:500,color:tc.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ev.hora} {ev.paciente}</div>
                                </div>
                              );
                            })}
                            {evs.length > 2 && <div style={{fontSize:9,color:'#849884',fontWeight:500}}>+{evs.length-2} más</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {calView === 'list' && (
                  <div>
                    <div style={{marginBottom:12}}>
                      <input value={calSearch} onChange={e=>setCalSearch(e.target.value)} placeholder="Buscar por código de reserva o paciente..." style={{padding:'8px 16px',borderRadius:20,border:'1.5px solid #c8ddc8',fontSize:12,fontFamily:"'DM Sans',sans-serif",background:'#fdfcfa',color:'#2a3528',outline:'none',width:'100%',maxWidth:400}} />
                    </div>
                    <div style={{...CARD,overflow:'hidden'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead><tr style={{borderBottom:'2px solid '+(dm?'#333':'#e2ede2')}}>
                        {['Código','Fecha','Hora','Paciente','Tipo','Duración','Estado','Pago',''].map(h => (
                          <th key={h} style={{padding:'11px 13px',textAlign:'left',fontSize:10,fontWeight:500,color:'#849884',textTransform:'uppercase',letterSpacing:'.5px',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {[...reservas].filter(ev => {
                          if (!calSearch.trim()) return true;
                          const q = calSearch.trim().toLowerCase();
                          const code = (ev.id||'').slice(0,8).toLowerCase();
                          return code.includes(q) || (ev.paciente||'').toLowerCase().includes(q) || (ev.email||'').toLowerCase().includes(q);
                        }).sort((a,b) => (a.fecha+a.hora).localeCompare(b.fecha+b.hora)).map(ev => {
                          const tc = TC[ev.tipo] || TC.Individual;
                          return (
                            <tr key={ev.id} onClick={()=>setSelRes(ev)} style={{borderBottom:'1px solid '+(dm?'#2a2a2a':'#f0f5f0'),cursor:'pointer',background:selRes?.id===ev.id?(dm?'#1a2e1f':'#f0f5f0'):'transparent'}} onMouseEnter={e=>{if(selRes?.id!==ev.id)e.currentTarget.style.background=(dm?'#252525':'#f8fbf8')}} onMouseLeave={e=>{if(selRes?.id!==ev.id)e.currentTarget.style.background='transparent'}}>
                              <td style={{padding:'11px 13px',fontFamily:'monospace',fontSize:11,color:'#849884'}}>{(ev.id||'').slice(0,8).toUpperCase()}</td>
                              <td style={{padding:'11px 13px',whiteSpace:'nowrap',fontSize:12,color:'#4e6050'}}>{ev.fecha}</td>
                              <td style={{padding:'11px 13px',fontWeight:500}}>{ev.hora}</td>
                              <td style={{padding:'11px 13px',fontWeight:500}}>{ev.paciente}</td>
                              <td style={{padding:'11px 13px'}}><span style={{background:tc.bg,color:tc.text,borderLeft:'2px solid '+tc.dot,padding:'2px 8px',borderRadius:4,fontSize:11}}>{ev.tipo}</span></td>
                              <td style={{padding:'11px 13px',color:'#849884'}}>{ev.duracion} min</td>
                              <td style={{padding:'11px 13px'}}><span style={bdg(ev.estado==='confirmada'||ev.estado==='completada'?'green':ev.estado==='cancelada'||ev.estado==='rechazada'?'red':'yellow')}>{ev.estado}</span></td>
                              <td style={{padding:'11px 13px'}}>{(() => {
                                const ps = bookingPayState(ev);
                                return ps ? <PayBadge status={ps}/> : <span style={{fontSize:10,color:'#c8ddc8'}}>—</span>;
                              })()}</td>
                              <td style={{padding:'11px 13px'}}>
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={e=>{e.stopPropagation();setEResId(ev.id);setResF({...ev});setResModal(true)}} style={{border:'none',background:'#f0f5f0',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.edit}</button>
                                  <button onClick={e=>{e.stopPropagation();delRes(ev.id)}} style={{border:'none',background:'#FFEBEE',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reservas.length === 0 && <div style={{padding:36,textAlign:'center',color:'#849884',fontSize:14}}>No hay citas registradas</div>}
                  </div>
                  </div>
                )}
              </div>

              {selRes && (
                <div style={{width:290,flexShrink:0,marginLeft:14,animation:'panelIn .22s'}}>
                  <div style={{...CARD,position:'sticky',top:72}}>
                    <div style={{padding:'16px 16px 10px',borderBottom:'1px solid #e2ede2',display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                      <div>
                        <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:16,fontWeight:400}}>{selRes.paciente}</h3>
                        <div style={{marginTop:5,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{...bdg(selRes.estado==='confirmada'||selRes.estado==='completada'?'green':selRes.estado==='cancelada'||selRes.estado==='rechazada'?'red':'yellow'),display:'inline-block'}}>{selRes.estado}</span>
                          {(() => { const ps = bookingPayState(selRes); return ps ? <PayBadge status={ps}/> : null; })()}
                        </div>
                      </div>
                      <button onClick={()=>setSelRes(null)} style={{border:'none',background:'#f0f5f0',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#849884'}}>{I.close}</button>
                    </div>
                    <div style={{padding:'12px 16px'}}>
                      {[
                        [I.calendar,'Fecha',selRes.fecha],
                        [I.clock,'Hora Miami',selRes.hora+' ('+selRes.duracion+' min)'],
                        [I.user,'Tipo',selRes.tipo],
                        [I.mail,'Email',selRes.email||'—'],
                        [I.msg,'Tel',selRes.telefono||'—'],
                        [I.globe,'Ubicación',selRes.pais||'—'],
                        ...(selRes.preferenciaPago ? [[I.credit,'Método de pago preferido',selRes.preferenciaPago]] : []),
                      ].map(([icon,label,val],i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
                          <span style={{color:'#849884',display:'flex',flexShrink:0}}>{icon}</span>
                          <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>{label}</div><div style={{fontSize:13,fontWeight:400}}>{val}</div></div>
                        </div>
                      ))}
                      {selRes.pais && selRes.pais !== 'Florida' && selRes.pais !== 'Otro' && selRes.fecha && selRes.hora && (() => {
                        const localT = getClientTime(selRes.fecha, selRes.hora, selRes.pais);
                        return localT ? (
                          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
                            <span style={{color:'#4a7a4a',display:'flex',flexShrink:0}}>{I.clock}</span>
                            <div><div style={{fontSize:10,color:'#4a7a4a',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>Hora {selRes.pais}</div><div style={{fontSize:13,fontWeight:500,color:'#4a7a4a'}}>{localT} hs</div></div>
                          </div>
                        ) : null;
                      })()}
                      {selRes.meetLink && (
                        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
                          <span style={{color:'#4a7a4a',display:'flex',flexShrink:0}}>{I.video || I.clock}</span>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>Google Meet</div>
                            <a href={selRes.meetLink} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:'#4a7a4a',fontWeight:500,textDecoration:'underline',wordBreak:'break-all'}}>{selRes.meetLink}</a>
                          </div>
                          <button onClick={()=>{navigator.clipboard.writeText(selRes.meetLink);show('Enlace copiado')}} style={{border:'1px solid #c8ddc8',background:'#f0f5f0',borderRadius:6,padding:'4px 10px',fontSize:11,color:'#4a7a4a',cursor:'pointer',flexShrink:0}}>Copiar</button>
                        </div>
                      )}
                      {selRes.motivo && <div style={{marginTop:8}}><div style={{fontSize:10,color:'#849884',fontWeight:600,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Motivo del paciente</div><div style={{padding:'8px 11px',background:dm?'#1a2a1a':'#f5f9f5',borderRadius:7,fontSize:12,color:dm?'#a0b8a0':'#5a7a5a',lineHeight:1.5,borderLeft:'3px solid #8fb08f'}}>{selRes.motivo}</div></div>}
                      {selRes.notas && <div style={{marginTop:8}}><div style={{fontSize:10,color:'#849884',fontWeight:600,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Notas internas</div><div style={{padding:'8px 11px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:7,fontSize:12,color:'#4e6050',fontStyle:'italic',lineHeight:1.5,borderLeft:'3px solid #c8ddc8'}}>{selRes.notas}</div></div>}
                      <div style={{display:'flex',gap:7,marginTop:14}}>
                        <button onClick={()=>{setEResId(selRes.id);setResF({...selRes});setResModal(true)}} style={{...btnP,flex:1,justifyContent:'center',fontSize:12,padding:'8px 0'}}>{I.edit} Editar</button>
                        <button onClick={()=>delRes(selRes.id)} style={{border:'none',background:'#FFEBEE',borderRadius:10,width:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                      </div>
                      {/* WhatsApp quick-send */}
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6,textAlign:'center'}}>Enviar WhatsApp</div>
                        {(() => {
                          const phoneOk = !!normalizePhone(selRes.telefono);
                          return (
                            <>
                              {!phoneOk && (
                                <div style={{fontSize:10,color:'#b08050',background:'#fff8e1',padding:'6px 9px',borderRadius:7,marginBottom:6,border:'1px solid #ffe0b2'}}>
                                  Formato de teléfono inválido — se abrirá el mensaje para copiar.
                                </div>
                              )}
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                                {WA_TEMPLATE_EVENTS.filter(e=>e!=='custom').map(evt=>(
                                  <button key={evt} onClick={()=>openWaFor(selRes, evt)} style={{padding:'6px 8px',border:'1.5px solid #c8e6c9',borderRadius:8,background:'#f1f8f1',color:'#2e7d32',fontSize:10,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>
                                    {WA_TEMPLATE_LABELS[evt]}
                                  </button>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      {selRes.fecha && selRes.hora && (
                        <div style={{marginTop:10}}>
                          <div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6,textAlign:'center'}}>Agregar al calendario</div>
                          <div style={{display:'flex',gap:6}}>
                            <a href={(() => {
                              const start = selRes.fecha.replace(/-/g,'') + 'T' + selRes.hora.replace(':','') + '00';
                              const [h,m] = selRes.hora.split(':').map(Number);
                              const dur = Number(selRes.duracion) || 60;
                              const endMin = h*60+m+dur;
                              const end = selRes.fecha.replace(/-/g,'') + 'T' + String(Math.floor(endMin/60)).padStart(2,'0') + String(endMin%60).padStart(2,'0') + '00';
                              return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Sesión: '+selRes.paciente+' — '+selRes.tipo)}&dates=${start}/${end}&details=${encodeURIComponent('Paciente: '+selRes.paciente+'\nTipo: '+selRes.tipo+(selRes.email?'\nEmail: '+selRes.email:'')+(selRes.telefono?'\nTel: '+selRes.telefono:''))}&location=Online`;
                            })()} target="_blank" rel="noopener noreferrer" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'7px 0',border:'1.5px solid #c8ddc8',borderRadius:9,fontSize:11,color:'#4e6050',textDecoration:'none',background:'#fdfcfa',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{I.calendar} Google</a>
                            <button onClick={() => {
                              const start = selRes.fecha.replace(/-/g,'') + 'T' + selRes.hora.replace(':','') + '00';
                              const [h,m] = selRes.hora.split(':').map(Number);
                              const dur = Number(selRes.duracion) || 60;
                              const endMin = h*60+m+dur;
                              const end = selRes.fecha.replace(/-/g,'') + 'T' + String(Math.floor(endMin/60)).padStart(2,'0') + String(endMin%60).padStart(2,'0') + '00';
                              const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Silvana Lopez//Dashboard//ES','BEGIN:VEVENT','DTSTART:'+start,'DTEND:'+end,'SUMMARY:Sesión: '+selRes.paciente+' — '+selRes.tipo,'DESCRIPTION:Paciente: '+selRes.paciente+'\\nTipo: '+selRes.tipo+(selRes.email?'\\nEmail: '+selRes.email:'')+(selRes.telefono?'\\nTel: '+selRes.telefono:''),'LOCATION:Online','END:VEVENT','END:VCALENDAR'].join('\r\n');
                              const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a'); a.href = url; a.download = 'sesion-'+selRes.paciente.replace(/\s+/g,'-').toLowerCase()+'.ics'; a.click(); URL.revokeObjectURL(url);
                            }} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'7px 0',border:'1.5px solid #c8ddc8',borderRadius:9,fontSize:11,color:'#4e6050',background:'#fdfcfa',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{I.calendar} .ics</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Modal dark={dm} open={resModal} onClose={()=>{setResModal(false);setEResId(null)}} title={eResId?'Editar Cita':'Nueva Cita'} width={520}>
                <Field label="Paciente"><input style={inp} value={resF.paciente} onChange={e=>setResF({...resF,paciente:sanitizeName(e.target.value)})} maxLength={80} placeholder="Nombre completo"/></Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 14px'}}>
                  <Field label="Email"><input style={inp} type="email" value={resF.email} onChange={e=>setResF({...resF,email:e.target.value})} placeholder="correo@mail.com"/></Field>
                  <Field label="Teléfono"><input style={inp} value={resF.telefono} onChange={e=>setResF({...resF,telefono:sanitizePhoneInput(e.target.value)})} maxLength={22} placeholder="+1 000 000 0000"/></Field>
                  <Field label="Ubicación"><select style={sel} value={resF.pais} onChange={e=>setResF({...resF,pais:e.target.value})}>{UBICACIONES.map(p=><option key={p} value={p}>{p||'— Sin ubicación —'}</option>)}</select></Field>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 14px'}}>
                  <Field label="Fecha"><input style={inp} type="date" value={resF.fecha} onChange={e=>setResF({...resF,fecha:e.target.value})}/></Field>
                  <Field label="Hora"><select style={sel} value={resF.hora} onChange={e=>setResF({...resF,hora:e.target.value})}><option value="">—</option>{HORAS.map(h=><option key={h}>{h}</option>)}</select></Field>
                  <Field label="Duración"><input style={{...inp,background:'#f0f5f0',cursor:'default'}} value={`${resF.duracion} min`} readOnly title="La duración se establece desde el servicio"/></Field>
                </div>
                {resF.pais && resF.pais !== 'Florida' && resF.pais !== 'Otro' && resF.fecha && resF.hora && (() => {
                  const localTime = getClientTime(resF.fecha, resF.hora, resF.pais);
                  return localTime ? (
                    <div style={{background:'#f0f7f0',border:'1px solid #c8dcc8',borderRadius:12,padding:'10px 14px',marginBottom:8,display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:16}}>🌎</span>
                      <span style={{fontSize:13,color:'#4a7a4a'}}>
                        Hora Miami: <strong>{resF.hora} hs</strong> — Hora {resF.pais}: <strong>{localTime} hs</strong>
                      </span>
                    </div>
                  ) : null;
                })()}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Servicio"><select style={sel} value={resF.serviceId} onChange={e=>{const sid=e.target.value;const svc=services.find(s=>s.id===sid);if(svc)setResF({...resF,serviceId:sid,tipo:svc.nombre,duracion:svc.duracion});else setResF({...resF,serviceId:'',tipo:'',duracion:60});}}><option value="">Seleccionar servicio...</option>{services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.nombre}{s.is_free?' (Gratis)':s.precio?' — $'+s.precio+' USD':''}</option>)}</select></Field>
                  <Field label="Estado"><select style={sel} value={resF.estado} onChange={e=>setResF({...resF,estado:e.target.value})}><option value="pendiente">Pendiente</option><option value="confirmada">Confirmada</option><option value="cancelada">Cancelada</option></select></Field>
                </div>
                <Field label="Notas"><textarea style={{...inp,minHeight:55,resize:'vertical'}} value={resF.notas} onChange={e=>setResF({...resF,notas:e.target.value})} placeholder="Observaciones..."/></Field>
                {(() => {
                  const booking = eResId ? reservas.find(r => r.id === eResId) : null;
                  const links = booking?.paymentLinks || [];
                  const bookingSvc = services.find(s=>s.id===resF.serviceId);
                  const isBookingFree = bookingSvc?.is_free === true;
                  // Only show links section if there are API-configured providers (Stripe/PayPal with actual links)
                  const hasApiLinks = links.length > 0;
                  if (!hasApiLinks) return null;
                  return (
                    <div style={{marginBottom:14}}>
                      <label style={{display:'block',fontSize:11,fontWeight:500,color:'#849884',marginBottom:5,letterSpacing:'.5px',textTransform:'uppercase',fontFamily:"'DM Sans',sans-serif"}}>Enlaces de pago (API)</label>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {links.map(pl => (
                          <div key={pl.id} style={{display:'flex',alignItems:'center',gap:8,background:'#f8faf8',border:'1px solid #e0e8e0',borderRadius:10,padding:'8px 12px'}}>
                            <PayBadge status={pl.status}/>
                            <span style={{fontSize:12,color:'#2a3528',flex:1}}>{pl.provider} · ${pl.total}</span>
                            <button onClick={()=>{navigator.clipboard?.writeText(pl.url);show('Link copiado')}} style={{border:'none',background:'#e8f0e8',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#4a7a4a'}}>Copiar</button>
                            <a href={absUrl(pl.url)} target="_blank" rel="noopener noreferrer" style={{border:'none',background:'#e8f0e8',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#4a7a4a',textDecoration:'none'}}>Abrir</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Comprobantes asociados */}
                {eResId && (() => {
                  const linkedInvs = invoices.filter(inv => inv.bookingId === eResId || inv.booking_id === eResId);
                  const bookingSvcForInv = services.find(s=>s.id===resF.serviceId);
                  const hasActivePayMethods = metodos.some(m => m.activo);
                  const canCreateInvoice = !bookingSvcForInv?.is_free && hasActivePayMethods;
                  return (
                    <div style={{marginBottom:14}}>
                      <label style={{display:'block',fontSize:11,fontWeight:500,color:'#849884',marginBottom:5,letterSpacing:'.5px',textTransform:'uppercase',fontFamily:"'DM Sans',sans-serif"}}>Comprobantes asociados</label>
                      {linkedInvs.length > 0 ? (
                        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                          {linkedInvs.map(inv => (
                            <div key={inv.id} style={{display:'flex',alignItems:'center',gap:8,background:'#f8faf8',border:'1px solid #e0e8e0',borderRadius:10,padding:'8px 12px'}}>
                              <span style={{fontSize:11,color:inv.estado==='pagada'?'#4a7a4a':inv.estado==='pendiente'?'#b08050':'#849884',fontWeight:500,textTransform:'uppercase',minWidth:60}}>{inv.estado}</span>
                              <span style={{fontSize:12,color:'#2a3528',flex:1}}>{inv.concepto} · ${Number(inv.monto).toFixed(2)} USD</span>
                              {inv.link && <button onClick={()=>{navigator.clipboard?.writeText(inv.link);show('Link copiado')}} style={{border:'none',background:'#e8f0e8',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#4a7a4a'}}>Copiar link</button>}
                              <button onClick={()=>prevInv(inv)} style={{border:'none',background:'#e8f0e8',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#4a7a4a'}}>Abrir</button>
                              <button onClick={()=>{setEInvId(inv.id);setInvF({paciente:inv.paciente||'',email:inv.email||'',telefono:inv.telefono||'',cedula:inv.cedula||'',pais:inv.pais||'',direccion:inv.direccion||'',concepto:inv.concepto||'',monto:String(Math.round(Number(inv.monto)*100)/100),estado:inv.estado||'pendiente',metodoPago:'',link:inv.link||'',bookingId:inv.bookingId||inv.booking_id||''});setInvModal(true)}} style={{border:'none',background:'#e8f0e8',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#4a7a4a'}}>Editar</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{fontSize:12,color:'#849884',margin:'0 0 8px',fontStyle:'italic'}}>Sin comprobantes asociados</p>
                      )}
                      {canCreateInvoice ? (
                        <button onClick={()=>{
                          const bk = reservas.find(r=>r.id===eResId);
                          const svc = bk ? services.find(s=>s.nombre===bk.tipo) : null;
                          setEInvId(null);
                          setInvF({...emptyInvF, bookingId: eResId, paciente: bk?.paciente||'', email: bk?.email||'', telefono: bk?.telefono||'', pais: bk?.pais||'', concepto: svc?.nombre||'', monto: svc&&svc.precio&&!svc.is_free?svc.precio:''});
                          setInvModal(true);
                        }} style={{border:'1px solid #c8ddc8',background:'#f0f5f0',borderRadius:8,padding:'6px 14px',fontSize:12,cursor:'pointer',color:'#4a7a4a',fontFamily:"'DM Sans',sans-serif"}}>
                          {I.plus} Crear comprobante para esta cita
                        </button>
                      ) : !hasActivePayMethods && !bookingSvcForInv?.is_free ? (
                        <p style={{fontSize:12,color:'#b08050',margin:0,fontStyle:'italic'}}>Configura al menos un método de pago activo para crear comprobantes.</p>
                      ) : null}
                    </div>
                  );
                })()}
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>{setResModal(false);setEResId(null)}} style={btnS}>Cancelar</button>
                  <button onClick={saveRes} style={btnP}>{I.check} {eResId?'Actualizar':'Crear'}</button>
                </div>
              </Modal>

              {/* Delete booking confirmation with payment links */}
              <Modal dark={dm} open={!!deleteModal} onClose={()=>setDeleteModal(null)} title="Eliminar cita" width={460}>
                {deleteModal && (
                  <>
                    <p style={{fontSize:13,color:'#4e6050',margin:'0 0 14px'}}>
                      Esta cita de <strong>{deleteModal.paciente}</strong> tiene {deleteModal.links.length} enlace(s) de pago asociado(s):
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                      {deleteModal.links.map(pl => (
                        <div key={pl.id} style={{display:'flex',alignItems:'center',gap:8,background:'#f8faf8',border:'1px solid #e0e8e0',borderRadius:10,padding:'8px 12px'}}>
                          <PayBadge status={pl.status}/>
                          <span style={{fontSize:12,color:'#2a3528',flex:1}}>{pl.provider} · ${pl.total}</span>
                        </div>
                      ))}
                    </div>
                    <label style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:deletePayLinks?'#FFEBEE':'#f8faf8',border:'1px solid '+(deletePayLinks?'#ffcdd2':'#e0e8e0'),borderRadius:10,cursor:'pointer',marginBottom:14,transition:'all .2s'}}>
                      <input type="checkbox" checked={deletePayLinks} onChange={e=>setDeletePayLinks(e.target.checked)} style={{width:16,height:16,accentColor:'#C62828'}} />
                      <span style={{fontSize:13,color:deletePayLinks?'#C62828':'#4e6050'}}>
                        {deletePayLinks ? 'Los enlaces de pago se eliminarán junto con la cita' : 'Eliminar también los enlaces de pago asociados'}
                      </span>
                    </label>
                    {!deletePayLinks && (
                      <p style={{fontSize:12,color:'#849884',margin:'0 0 14px',fontStyle:'italic'}}>Los enlaces de pago se desvincularan de la cita pero se mantendrán activos.</p>
                    )}
                    <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                      <button onClick={()=>setDeleteModal(null)} style={btnS}>Cancelar</button>
                      <button onClick={confirmDelRes} style={{...btnP,background:'#C62828',color:'#fff'}}>{I.trash} Eliminar cita</button>
                    </div>
                  </>
                )}
              </Modal>
            </div>
          )}

          {/* DISPONIBILIDAD */}
          {section === 'disponibilidad' && (
            <div style={{animation:'slideIn .3s',display:'grid',gap:16}}>
              <p style={{color:'#849884',margin:'0 0 6px',fontSize:14,fontWeight:300}}>
                Define tu horario laboral semanal y bloquea días u horas específicas con excepciones.
              </p>

              {/* Working hours multi-range */}
              <div style={{...CARD,padding:26}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
                  <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:0,fontWeight:400}}>Horario laboral semanal</h3>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setWhDraft(JSON.parse(JSON.stringify(workingHours)))} style={btnS}>Restablecer</button>
                    <button onClick={saveWorkingHours} style={btnP}>{I.check} Guardar</button>
                  </div>
                </div>
                <div style={{border:'1px solid #c8ddc8',borderRadius:10,overflow:'hidden'}}>
                  {DAY_KEYS.map(key => {
                    const day = whDraft[key] || {enabled:false,ranges:[]};
                    const setDay = (upd) => setWhDraft(p => ({...p,[key]:{...p[key],...upd}}));
                    const updateRange = (idx, field, val) => {
                      const ranges = [...(day.ranges||[])];
                      ranges[idx] = {...ranges[idx],[field]:val};
                      setDay({ranges});
                    };
                    const addRange = () => {
                      if ((day.ranges||[]).length >= 3) return;
                      const last = day.ranges?.[day.ranges.length-1];
                      const newRange = last ? {start:last.end,end:'18:00'} : {start:'09:00',end:'13:00'};
                      setDay({ranges:[...(day.ranges||[]),newRange]});
                    };
                    const removeRange = (idx) => setDay({ranges:(day.ranges||[]).filter((_,i)=>i!==idx)});
                    const toggleEnabled = () => {
                      if (!day.enabled && (!day.ranges || day.ranges.length === 0)) {
                        setDay({enabled:true,ranges:[{start:'09:00',end:'18:00'}]});
                      } else {
                        setDay({enabled:!day.enabled});
                      }
                    };
                    return (
                      <div key={key} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',borderBottom:'1px solid #e2ede2',background:day.enabled?'transparent':'#f8f8f6'}}>
                        <button onClick={toggleEnabled} style={{marginTop:3,width:34,height:18,borderRadius:9,border:'none',background:day.enabled?'#4a7a4a':'#c8ddc8',cursor:'pointer',position:'relative',flexShrink:0}}>
                          <div style={{width:12,height:12,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:day.enabled?19:3,transition:'left .3s',boxShadow:'0 1px 2px rgba(0,0,0,.15)'}}/>
                        </button>
                        <span style={{width:90,fontSize:13,fontWeight:500,color:day.enabled?'#2a3528':'#849884',marginTop:5}}>{DAY_LABELS_ES[key]}</span>
                        {day.enabled ? (
                          <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
                            {(day.ranges||[]).map((r,idx) => (
                              <div key={idx} style={{display:'flex',alignItems:'center',gap:6}}>
                                <input type="time" style={{...inp,padding:'5px 8px',fontSize:12,width:100,marginBottom:0}} value={r.start} onChange={e=>updateRange(idx,'start',e.target.value)}/>
                                <span style={{fontSize:11,color:'#849884'}}>a</span>
                                <input type="time" style={{...inp,padding:'5px 8px',fontSize:12,width:100,marginBottom:0}} value={r.end} onChange={e=>updateRange(idx,'end',e.target.value)}/>
                                <button onClick={()=>removeRange(idx)} style={{border:'none',background:'#FFEBEE',borderRadius:6,width:26,height:26,cursor:'pointer',color:'#C62828',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>×</button>
                              </div>
                            ))}
                            {(day.ranges||[]).length < 3 && (
                              <button onClick={addRange} style={{alignSelf:'flex-start',border:'1px dashed #c8ddc8',background:'transparent',color:'#4a7a4a',borderRadius:8,padding:'5px 12px',fontSize:11,cursor:'pointer'}}>+ Agregar rango</button>
                            )}
                          </div>
                        ) : (
                          <span style={{fontSize:12,color:'#849884',fontStyle:'italic',marginTop:5}}>Cerrado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{fontSize:11,color:'#849884',margin:'10px 0 0',fontStyle:'italic'}}>Máx. 3 rangos por día. Ejemplo: 9:00-12:00 y 14:00-18:00 para un descanso al mediodía.</p>
              </div>

              {/* Exceptions CRUD */}
              <div style={{...CARD,padding:26}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
                  <div>
                    <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:0,fontWeight:400}}>Excepciones de disponibilidad</h3>
                    <p style={{color:'#849884',margin:'4px 0 0',fontSize:12,fontWeight:300}}>Bloquea fechas puntuales, rangos o patrones recurrentes. Invalidan slots en el booking público.</p>
                  </div>
                  <button onClick={()=>openExcModal(null)} style={btnP}>{I.plus} Nueva excepción</button>
                </div>
                <div style={{display:'grid',gap:8}}>
                  {exceptions.length === 0 && (
                    <p style={{color:'#849884',fontSize:13,textAlign:'center',padding:24,fontStyle:'italic'}}>No hay excepciones configuradas.</p>
                  )}
                  {exceptions.map(exc => {
                    const typeLabel = exc.type==='dates'?'Fechas':exc.type==='range'?'Rango':'Recurrente';
                    const typeColor = exc.type==='dates'?'#5a82b0':exc.type==='range'?'#c4956a':'#8b5a8b';
                    let summary = '';
                    if (exc.type==='dates') summary = (exc.dates||[]).slice(0,3).join(', ') + ((exc.dates||[]).length>3?` (+${exc.dates.length-3})`:'');
                    else if (exc.type==='range') summary = `${exc.start_date} → ${exc.end_date}`;
                    else {
                      const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                      summary = (exc.days_of_week||[]).map(d=>names[d]).join(', ') + ` · desde ${exc.start_date}` + (exc.end_date?` hasta ${exc.end_date}`:' (indefinido)');
                    }
                    const timeLabel = exc.all_day ? 'Todo el día' : (exc.start_time && exc.end_time ? `${exc.start_time?.slice(0,5)}-${exc.end_time?.slice(0,5)}` : 'Todo el día');
                    return (
                      <div key={exc.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:dm?'#1a1a1a':'#f8faf8',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2')}}>
                        <span style={{padding:'3px 9px',borderRadius:12,background:typeColor+'22',color:typeColor,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px'}}>{typeLabel}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:500,color:txMain}}>{exc.title}</div>
                          <div style={{fontSize:11,color:'#849884',marginTop:2}}>{summary} · {timeLabel}</div>
                          {exc.notes && <div style={{fontSize:11,color:'#849884',fontStyle:'italic',marginTop:2}}>{exc.notes}</div>}
                        </div>
                        <button onClick={()=>openExcModal(exc)} style={{border:'none',background:'#e2ede2',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.edit}</button>
                        <button onClick={()=>{if(confirm('¿Eliminar excepción?'))removeException(exc.id)}} style={{border:'none',background:'#FFEBEE',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exception modal */}
              <Modal dark={dm} open={excModal} onClose={()=>setExcModal(false)} title={excEditId?'Editar Excepción':'Nueva Excepción'} width={560}>
                <Field label="Título"><input style={inp} value={excF.title} onChange={e=>setExcF({...excF,title:e.target.value})} placeholder="Ej: Cita médica, Vacaciones, Yoga semanal"/></Field>
                <Field label="Tipo de excepción">
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[{v:'dates',l:'Fechas puntuales'},{v:'range',l:'Rango continuo'},{v:'recurring',l:'Recurrente'}].map(o=>(
                      <button key={o.v} onClick={()=>setExcF({...excF,type:o.v})} style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid',fontSize:12,cursor:'pointer',borderColor:excF.type===o.v?'#4a7a4a':'#c8ddc8',background:excF.type===o.v?'#f0f5f0':'transparent',color:excF.type===o.v?'#4a7a4a':'#849884',fontWeight:excF.type===o.v?500:400}}>{o.l}</button>
                    ))}
                  </div>
                </Field>

                {excF.type === 'dates' && (
                  <Field label="Fechas (agrega una o varias)">
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <input type="date" min={todayISO} style={{...inp,marginBottom:0,flex:1}} value={excF.newDateInput} onChange={e=>setExcF({...excF,newDateInput:e.target.value})}/>
                      <button onClick={()=>{
                        if(!excF.newDateInput) return;
                        if(excF.newDateInput < todayISO) { show('No puedes bloquear fechas pasadas'); return; }
                        if(excF.dates.includes(excF.newDateInput)) { show('Fecha ya agregada'); return; }
                        setExcF({...excF,dates:[...excF.dates,excF.newDateInput].sort(),newDateInput:''});
                      }} style={{...btnP,padding:'7px 14px',fontSize:12}}>+ Añadir</button>
                    </div>
                    {excF.dates.length > 0 && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                        {excF.dates.map(d=>(
                          <span key={d} style={{padding:'4px 10px',borderRadius:14,background:'#f0f5f0',border:'1px solid #c8ddc8',fontSize:11,color:'#4a7a4a',display:'flex',alignItems:'center',gap:6}}>
                            {d}
                            <button onClick={()=>setExcF({...excF,dates:excF.dates.filter(x=>x!==d)})} style={{border:'none',background:'transparent',color:'#C62828',cursor:'pointer',padding:0,fontSize:14,lineHeight:1}}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>
                )}

                {excF.type === 'range' && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Desde"><input type="date" min={todayISO} style={inp} value={excF.start_date} onChange={e=>setExcF({...excF,start_date:e.target.value})}/></Field>
                    <Field label="Hasta"><input type="date" min={excF.start_date || todayISO} style={inp} value={excF.end_date} onChange={e=>setExcF({...excF,end_date:e.target.value})}/></Field>
                  </div>
                )}

                {excF.type === 'recurring' && (
                  <>
                    <Field label="Días de la semana">
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d,idx)=>{
                          const on = excF.days_of_week.includes(idx);
                          return (
                            <button key={idx} onClick={()=>setExcF({...excF,days_of_week: on ? excF.days_of_week.filter(x=>x!==idx) : [...excF.days_of_week,idx].sort()})} style={{width:40,height:36,borderRadius:8,border:'1.5px solid',cursor:'pointer',fontSize:12,borderColor:on?'#4a7a4a':'#c8ddc8',background:on?'#f0f5f0':'transparent',color:on?'#4a7a4a':'#849884',fontWeight:on?600:400}}>{d}</button>
                          );
                        })}
                      </div>
                    </Field>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                      <Field label="Desde"><input type="date" min={todayISO} style={inp} value={excF.start_date} onChange={e=>setExcF({...excF,start_date:e.target.value})}/></Field>
                      <Field label="Hasta (opcional)"><input type="date" min={excF.start_date || todayISO} style={inp} value={excF.end_date} onChange={e=>setExcF({...excF,end_date:e.target.value})}/></Field>
                    </div>
                  </>
                )}

                <Field label="Horario del bloqueo">
                  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',marginBottom:8}}>
                    <input type="checkbox" checked={excF.all_day} onChange={e=>setExcF({...excF,all_day:e.target.checked})}/>
                    Bloquear todo el día
                  </label>
                  {!excF.all_day && (
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="time" style={{...inp,width:120,marginBottom:0}} value={excF.start_time} onChange={e=>setExcF({...excF,start_time:e.target.value})}/>
                      <span style={{fontSize:12,color:'#849884'}}>a</span>
                      <input type="time" style={{...inp,width:120,marginBottom:0}} value={excF.end_time} onChange={e=>setExcF({...excF,end_time:e.target.value})}/>
                    </div>
                  )}
                </Field>

                <Field label="Notas (opcional)"><textarea style={{...inp,minHeight:60,resize:'vertical'}} value={excF.notes} onChange={e=>setExcF({...excF,notes:e.target.value})} placeholder="Detalles internos — no se muestran al cliente"/></Field>

                <div style={{display:'flex',gap:10,justifyContent:'space-between',marginTop:4}}>
                  {excEditId ? (
                    <button onClick={async ()=>{if(confirm('¿Eliminar excepción?')){await removeException(excEditId);setExcModal(false)}}} style={{...btnS,color:'#C62828',borderColor:'#FFCDD2'}}>{I.trash} Eliminar</button>
                  ) : <div/>}
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>setExcModal(false)} style={btnS}>Cancelar</button>
                    <button onClick={saveException} disabled={savingExc} style={{...btnP,opacity:savingExc?0.6:1,cursor:savingExc?'wait':'pointer'}}>{I.check} {savingExc?'Guardando…':(excEditId?'Actualizar':'Crear')}</button>
                  </div>
                </div>
              </Modal>
            </div>
          )}

          {/* MÉTODOS DE PAGO */}
          {section === 'pagos' && (
            <div style={{animation:'slideIn .3s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <p style={{color:'#849884',margin:0,fontSize:14,fontWeight:300}}>Configura cómo recibes los pagos. Ordénalos por prioridad.</p>
                <button onClick={()=>{setEMetId(null);setMetViewId(null);setMetF({tipo:'Transferencia',nombre:'',banco:'',titular:'',cuentaVisible:'',cuentaCompleta:'',moneda:'USD',tiempoConfirm:'24 horas',instrucciones:'',notasInternas:'',correoProveedor:'',comision:'',estadoConexion:'conectado',monedasAceptadas:'USD',pagosRecurrentes:false,tipoCuenta:'Personal',tiempoAcredit:'Instantáneo',politicaReembolso:'',clavePublica:'',claveSecreta:'',idComercio:'',prioridad:metodos.length+1,recargoPct:0,color:''});setMetModal(true)}} style={btnP}>{I.plus} Agregar método</button>
              </div>
              <div style={{display:'grid',gap:12}}>
                {[...metodos].sort((a,b)=>a.prioridad-b.prioridad).map((m) => {
                  const isOpen = metViewId === m.id;
                  const typeIcon = m.tipo==='PayPal'?'PP':m.tipo==='Tarjeta'?'💳':m.tipo==='Transferencia'?'🏦':m.tipo==='Efectivo'?'💵':'💱';
                  const metColor = m.color || (m.tipo==='Transferencia'?'#4a7a4a':m.tipo==='Tarjeta'?'#5a82b0':m.tipo==='PayPal'?'#0070ba':m.tipo==='Efectivo'?'#6b8e6b':'#8b7355');
                  const gradBg = `linear-gradient(135deg, ${metColor}, ${metColor}dd)`;
                  return (
                  <div key={m.id} style={{...CARD,overflow:'hidden',opacity:m.activo?1:.5,transition:'opacity .3s'}}>
                    <div style={{padding:'18px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setMetViewId(isOpen?null:m.id)}>
                      <div style={{display:'flex',alignItems:'center',gap:14}}>
                        <div style={{width:44,height:44,borderRadius:12,background:gradBg,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:m.tipo==='PayPal'||m.tipo==='Tarjeta'?14:20,fontWeight:m.tipo==='PayPal'?700:400,fontStyle:m.tipo==='PayPal'?'italic':'normal',letterSpacing:m.tipo==='PayPal'?'-1px':'normal'}}>{typeIcon}</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:500,display:'flex',alignItems:'center',gap:8}}>{m.nombre||m.tipo}
                            <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:m.activo?'#f0f5f0':'#FFEBEE',color:m.activo?'#4a7a4a':'#C62828',fontWeight:600}}>{m.activo?'Activo':'Inactivo'}</span>
                            <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#f0f5f0',color:'#849884'}}>Prioridad {m.prioridad}</span>
                            {(m.tipo==='Stripe'||m.tipo==='PayPal') && m.claveSecreta && (
                              <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'#e8f5e9',color:'#2e7d32',fontWeight:600,display:'flex',alignItems:'center',gap:3}} title="API conectada — credenciales configuradas">● API Conectada</span>
                            )}
                          </div>
                          <div style={{fontSize:12,color:'#849884',marginTop:2}}>{m.titular} · {m.cuentaVisible||m.banco}</div>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:7}}>
                        <button onClick={async e=>{e.stopPropagation();const nv=!m.activo;setMetodos(p=>p.map(x=>x.id===m.id?{...x,activo:nv}:x));try{await togglePaymentMethodActive(m.id,nv)}catch(er){show('Error al cambiar estado')}}} style={{width:42,height:22,borderRadius:11,border:'none',background:m.activo?'#4a7a4a':'#c8ddc8',cursor:'pointer',position:'relative',transition:'background .3s'}}>
                          <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:m.activo?23:3,transition:'left .3s',boxShadow:'0 1px 3px rgba(0,0,0,.15)'}}/>
                        </button>
                        <button onClick={e=>{e.stopPropagation();setEMetId(m.id);setMetF({...m});setMetModal(true)}} style={{border:'none',background:'#f0f5f0',borderRadius:7,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4e6050'}}>{I.edit}</button>
                        <button onClick={async e=>{e.stopPropagation();setMetodos(p=>p.filter(x=>x.id!==m.id));show('Eliminado');try{await deletePaymentMethod(m.id)}catch(er){show('Error al eliminar')}}} style={{border:'none',background:'#FFEBEE',borderRadius:7,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                        <span style={{color:'#849884',transform:isOpen?'rotate(90deg)':'rotate(0)',transition:'transform .2s'}}>{I.chevR}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div style={{padding:'0 20px 20px',borderTop:'1px solid '+borderC}}>
                        <div style={{padding:'16px 0 0',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 24px'}}>
                          {/* Common fields */}
                          <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Tipo</div><div style={{fontSize:13}}>{m.tipo}</div></div>
                          <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Titular</div><div style={{fontSize:13}}>{m.titular}</div></div>

                          {/* Transfer-specific */}
                          {m.tipo==='Transferencia' && <>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Banco</div><div style={{fontSize:13}}>{m.banco}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Cuenta (visible)</div><div style={{fontSize:13}}>{m.cuentaVisible}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Moneda</div><div style={{fontSize:13}}>{m.moneda}</div></div>
                            {m.idComercio && <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>ABA Routing</div><div style={{fontSize:13}}>{m.idComercio}</div></div>}
                            {m.clavePublica && <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Swift Code</div><div style={{fontSize:13}}>{m.clavePublica}</div></div>}
                            {m.claveSecreta && <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Dirección sucursal</div><div style={{fontSize:13}}>{m.claveSecreta}</div></div>}
                            {m.politicaReembolso && <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Dirección del titular</div><div style={{fontSize:13}}>{m.politicaReembolso}</div></div>}
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Confirmación</div><div style={{fontSize:13}}>{m.tiempoConfirm}</div></div>
                            {m.instrucciones && <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Instrucciones</div><div style={{fontSize:13,color:'#4e6050',fontStyle:'italic'}}>{m.instrucciones}</div></div>}
                          </>}

                          {/* Zelle-specific */}
                          {m.tipo==='Zelle' && <>
                            {m.correoProveedor && <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Correo Zelle</div><div style={{fontSize:13}}>{m.correoProveedor}</div></div>}
                            {m.banco && <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Banco asociado</div><div style={{fontSize:13}}>{m.banco}</div></div>}
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Moneda</div><div style={{fontSize:13}}>{m.moneda}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Confirmación</div><div style={{fontSize:13}}>{m.tiempoConfirm}</div></div>
                            {m.instrucciones && <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Instrucciones</div><div style={{fontSize:13,color:'#4e6050',fontStyle:'italic'}}>{m.instrucciones}</div></div>}
                          </>}

                          {/* Card/Stripe-specific */}
                          {m.tipo==='Tarjeta' && <>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Proveedor</div><div style={{fontSize:13}}>{m.banco}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Depósito</div><div style={{fontSize:13}}>{m.cuentaVisible}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Comisión</div><div style={{fontSize:13}}>{m.comision||'—'}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Conexión</div><div style={{fontSize:13,display:'flex',alignItems:'center',gap:6}}><span style={{width:7,height:7,borderRadius:'50%',background:m.estadoConexion==='conectado'?'#4a7a4a':'#C62828'}}/>{m.estadoConexion}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Monedas</div><div style={{fontSize:13}}>{m.monedasAceptadas}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Pagos recurrentes</div><div style={{fontSize:13}}>{m.pagosRecurrentes?'Sí':'No'}</div></div>
                          </>}

                          {/* PayPal-specific */}
                          {m.tipo==='PayPal' && <>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Correo PayPal</div><div style={{fontSize:13}}>{m.cuentaVisible}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Tipo de cuenta</div><div style={{fontSize:13}}>{m.tipoCuenta||'Personal'}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Monedas</div><div style={{fontSize:13}}>{m.monedasAceptadas||'—'}</div></div>
                            <div><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Acreditación</div><div style={{fontSize:13}}>{m.tiempoAcredit||'—'}</div></div>
                            {m.politicaReembolso && <div style={{gridColumn:'1/-1'}}><div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Política de reembolso</div><div style={{fontSize:13,fontStyle:'italic',color:'#4e6050'}}>{m.politicaReembolso}</div></div>}
                          </>}

                          {/* Internal notes (all types) */}
                          {m.notasInternas && (
                            <div style={{gridColumn:'1/-1',marginTop:6,padding:'10px 14px',background:dm?'#252525':'#f0f5f0',borderRadius:8,borderLeft:'3px solid #c4956a'}}>
                              <div style={{fontSize:10,color:'#c4956a',fontWeight:600,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:3}}>Notas internas (solo administrador)</div>
                              <div style={{fontSize:12,color:'#4e6050'}}>{m.notasInternas}</div>
                            </div>
                          )}

                          {/* Full account (internal) */}
                          {m.cuentaCompleta && (
                            <div style={{gridColumn:'1/-1'}}>
                              <div style={{fontSize:10,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2}}>Cuenta completa (interno)</div>
                              <div style={{fontSize:12,fontFamily:'monospace',color:'#4e6050',background:dm?'#252525':'#f0f5f0',padding:'6px 10px',borderRadius:6}}>{m.cuentaCompleta}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Add/Edit Method Modal */}
              <Modal dark={dm} open={metModal} onClose={()=>{setMetModal(false);setEMetId(null)}} title={eMetId?'Editar Método':'Agregar Método'} width={560}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Tipo de método"><select style={sel} value={metF.tipo} onChange={e=>setMetF({...metF,tipo:e.target.value})}><option>Transferencia</option><option>Zelle</option><option>Tarjeta</option><option>PayPal</option><option>Efectivo</option><option>Otro</option></select></Field>
                  <Field label="Nombre visible"><input style={inp} value={metF.nombre} onChange={e=>setMetF({...metF,nombre:e.target.value})} placeholder="Ej: Transferencia bancaria BBVA"/></Field>
                </div>

                {metF.tipo==='Transferencia' && <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Banco (Bank)"><input style={inp} value={metF.banco} onChange={e=>setMetF({...metF,banco:e.target.value})} placeholder="Chase, Bank of America..."/></Field>
                    <Field label="Moneda"><select style={sel} value={metF.moneda} onChange={e=>setMetF({...metF,moneda:e.target.value})}><option value="USD">USD — Dólar estadounidense</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Libra esterlina</option><option value="ARS">ARS — Peso argentino</option><option value="MXN">MXN — Peso mexicano</option><option value="COP">COP — Peso colombiano</option><option value="CLP">CLP — Peso chileno</option><option value="BRL">BRL — Real brasileño</option><option value="PEN">PEN — Sol peruano</option><option value="UYU">UYU — Peso uruguayo</option></select></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Titular (Account Holder)"><input style={inp} value={metF.titular} onChange={e=>setMetF({...metF,titular:e.target.value})} placeholder="Nombre del titular"/></Field>
                    <Field label="Número de cuenta (Account Number)"><input style={inp} value={metF.cuentaCompleta} onChange={e=>setMetF({...metF,cuentaCompleta:e.target.value})} placeholder="1234567890"/></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Cuenta visible (para cliente)"><input style={inp} value={metF.cuentaVisible} onChange={e=>setMetF({...metF,cuentaVisible:e.target.value})} placeholder="**** 4521"/></Field>
                    <Field label="ABA Routing Number"><input style={inp} value={metF.idComercio} onChange={e=>setMetF({...metF,idComercio:e.target.value})} placeholder="021000021"/></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Swift Code"><input style={inp} value={metF.clavePublica} onChange={e=>setMetF({...metF,clavePublica:e.target.value})} placeholder="CHASUS33"/></Field>
                    <Field label="Dirección de la sucursal (Branch Address)"><input style={inp} value={metF.claveSecreta} onChange={e=>setMetF({...metF,claveSecreta:e.target.value})} placeholder="123 Main St, Miami FL 33101"/></Field>
                  </div>
                  <Field label="Dirección del titular (Account Holder Address)"><input style={inp} value={metF.politicaReembolso} onChange={e=>setMetF({...metF,politicaReembolso:e.target.value})} placeholder="123 Main St, Miami FL 33101"/></Field>
                  <Field label="Tiempo de confirmación"><select style={sel} value={metF.tiempoConfirm} onChange={e=>setMetF({...metF,tiempoConfirm:e.target.value})}><option value="Instantáneo">Instantáneo</option><option value="1 hora">1 hora</option><option value="2 horas">2 horas</option><option value="6 horas">6 horas</option><option value="12 horas">12 horas</option><option value="24 horas">24 horas</option><option value="48 horas">48 horas</option><option value="72 horas">72 horas</option><option value="5 días">5 días</option><option value="7 días">7 días</option></select></Field>
                </>}

                {metF.tipo==='Zelle' && <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Correo Zelle"><input style={inp} value={metF.correoProveedor} onChange={e=>setMetF({...metF,correoProveedor:e.target.value})} placeholder="correo@zelle.com"/></Field>
                    <Field label="Banco asociado"><input style={inp} value={metF.banco} onChange={e=>setMetF({...metF,banco:e.target.value})} placeholder="Bank of America, Chase..."/></Field>
                  </div>
                  <Field label="Titular"><input style={inp} value={metF.titular} onChange={e=>setMetF({...metF,titular:e.target.value})} placeholder="Nombre del titular"/></Field>
                  <Field label="Moneda"><select style={sel} value={metF.moneda} onChange={e=>setMetF({...metF,moneda:e.target.value})}><option value="USD">USD — Dólar estadounidense</option></select></Field>
                  <Field label="Tiempo de confirmación"><select style={sel} value={metF.tiempoConfirm} onChange={e=>setMetF({...metF,tiempoConfirm:e.target.value})}><option value="Instantáneo">Instantáneo</option><option value="1 hora">1 hora</option><option value="2 horas">2 horas</option></select></Field>
                </>}

                {metF.tipo==='Tarjeta' && <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Proveedor"><input style={inp} value={metF.banco} onChange={e=>setMetF({...metF,banco:e.target.value})} placeholder="Stripe, Square, MercadoPago..."/></Field>
                    <Field label="Correo de cuenta"><input style={inp} value={metF.correoProveedor} onChange={e=>setMetF({...metF,correoProveedor:e.target.value})} placeholder="correo@proveedor.com"/></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Últimos 4 dígitos depósito"><input style={inp} value={metF.cuentaVisible} onChange={e=>setMetF({...metF,cuentaVisible:e.target.value})} placeholder="**** 7890"/></Field>
                    <Field label="Comisión"><input style={inp} value={metF.comision} onChange={e=>setMetF({...metF,comision:e.target.value})} placeholder="2.9% + $0.30"/></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Estado de conexión"><select style={sel} value={metF.estadoConexion} onChange={e=>setMetF({...metF,estadoConexion:e.target.value})}><option value="conectado">Conectado</option><option value="desconectado">Requiere reconectar</option></select></Field>
                    <Field label="Monedas aceptadas"><input style={inp} value={metF.monedasAceptadas} onChange={e=>setMetF({...metF,monedasAceptadas:e.target.value})} placeholder="USD, EUR, ARS"/></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Clave pública (Public Key)"><input style={inp} value={metF.clavePublica} onChange={e=>setMetF({...metF,clavePublica:e.target.value})} placeholder="pk_live_..."/></Field>
                    <Field label="Clave secreta (Secret Key)"><input style={inp} type="password" value={metF.claveSecreta} onChange={e=>setMetF({...metF,claveSecreta:e.target.value})} placeholder="sk_live_..."/></Field>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                    <button onClick={()=>setMetF({...metF,pagosRecurrentes:!metF.pagosRecurrentes})} style={{width:42,height:22,borderRadius:11,border:'none',background:metF.pagosRecurrentes?'#4a7a4a':'#c8ddc8',cursor:'pointer',position:'relative',transition:'background .3s'}}>
                      <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:metF.pagosRecurrentes?23:3,transition:'left .3s',boxShadow:'0 1px 3px rgba(0,0,0,.15)'}}/>
                    </button>
                    <span style={{fontSize:13,color:'#4e6050'}}>Activar pagos recurrentes</span>
                  </div>
                </>}

                {metF.tipo==='PayPal' && <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Correo PayPal"><input style={inp} value={metF.cuentaVisible} onChange={e=>setMetF({...metF,cuentaVisible:e.target.value,cuentaCompleta:e.target.value})} placeholder="correo@paypal.com"/></Field>
                    <Field label="Tipo de cuenta"><select style={sel} value={metF.tipoCuenta} onChange={e=>setMetF({...metF,tipoCuenta:e.target.value})}><option>Personal</option><option>Business</option></select></Field>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Monedas aceptadas"><input style={inp} value={metF.monedasAceptadas} onChange={e=>setMetF({...metF,monedasAceptadas:e.target.value})} placeholder="USD, EUR"/></Field>
                    <Field label="Tiempo de acreditación"><input style={inp} value={metF.tiempoAcredit} onChange={e=>setMetF({...metF,tiempoAcredit:e.target.value})} placeholder="Instantáneo"/></Field>
                  </div>
                  <Field label="Política de reembolsos"><input style={inp} value={metF.politicaReembolso} onChange={e=>setMetF({...metF,politicaReembolso:e.target.value})} placeholder="Reembolso hasta 30 días..."/></Field>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Client ID (Clave pública)"><input style={inp} value={metF.clavePublica} onChange={e=>setMetF({...metF,clavePublica:e.target.value})} placeholder="Client ID..."/></Field>
                    <Field label="Client Secret (Clave secreta)"><input style={inp} type="password" value={metF.claveSecreta} onChange={e=>setMetF({...metF,claveSecreta:e.target.value})} placeholder="Client Secret..."/></Field>
                  </div>
                  <Field label="Merchant ID (ID Comercio)"><input style={inp} value={metF.idComercio} onChange={e=>setMetF({...metF,idComercio:e.target.value})} placeholder="MERCH-123456..."/></Field>
                </>}

                {(metF.tipo==='Efectivo'||metF.tipo==='Otro') && <>
                  <Field label="Descripción / Banco"><input style={inp} value={metF.banco} onChange={e=>setMetF({...metF,banco:e.target.value})} placeholder="Descripción del método"/></Field>
                  <Field label="Cuenta / Referencia"><input style={inp} value={metF.cuentaVisible} onChange={e=>setMetF({...metF,cuentaVisible:e.target.value})} placeholder="Referencia visible"/></Field>
                </>}

                {/* General fields for all types */}
                <div style={{borderTop:'1px solid '+borderC,paddingTop:14,marginTop:4}}>
                  <Field label="Color identificador">
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {['#4a7a4a','#5a82b0','#0070ba','#6b8e6b','#8b7355','#c4956a','#7a5a8b','#b05a5a','#5aaa8b','#3a6a3a','#d4a853','#4682B4'].map(c=>(
                        <button key={c} onClick={()=>setMetF({...metF,color:c})} style={{width:30,height:30,borderRadius:8,background:c,border:metF.color===c?'2.5px solid #2a3528':'2px solid transparent',cursor:'pointer',transition:'border .2s'}}/>
                      ))}
                    </div>
                  </Field>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                    <Field label="Prioridad (orden para el cliente)"><input style={inp} type="number" min="1" value={metF.prioridad} onChange={e=>setMetF({...metF,prioridad:Number(e.target.value)})}/></Field>
                    <Field label="Recargo adicional (%)"><input style={inp} type="number" min="0" max="100" step="0.5" value={metF.recargoPct} onChange={e=>setMetF({...metF,recargoPct:Number(e.target.value)})} placeholder="0"/></Field>
                  </div>
                  {metF.recargoPct > 0 && <div style={{background:'#FFF8E1',borderRadius:10,padding:'8px 14px',fontSize:12,color:'#b08050',border:'1px solid #ffe0b2',marginBottom:10}}>Se aplicará un {metF.recargoPct}% adicional al monto en los comprobantes que usen este método.</div>}
                  <Field label="Instrucciones para el cliente"><textarea style={{...inp,minHeight:50,resize:'vertical',fontSize:13}} value={metF.instrucciones} onChange={e=>setMetF({...metF,instrucciones:e.target.value})} placeholder="Ej: Enviar captura de pantalla como comprobante por WhatsApp..."/></Field>
                  <Field label="Notas internas (solo administrador)"><textarea style={{...inp,minHeight:50,resize:'vertical',fontSize:13}} value={metF.notasInternas} onChange={e=>setMetF({...metF,notasInternas:e.target.value})} placeholder="Notas visibles solo para ti..."/></Field>
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>{setMetModal(false);setEMetId(null)}} style={btnS}>Cancelar</button>
                  <button onClick={saveMet} style={btnP}>{I.check} {eMetId?'Actualizar':'Agregar'}</button>
                </div>
              </Modal>
            </div>
          )}

          {/* INTEGRACIONES */}
          {section === 'integraciones' && (
            <div style={{animation:'slideIn .3s',display:'grid',gap:16}}>
              <p style={{color:'#849884',margin:0,fontSize:14,fontWeight:300}}>Conecta servicios externos y configura las plantillas de mensajes automáticos.</p>

              {/* Cards grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

                {/* Google Calendar / Meet */}
                <div style={{...CARD,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#4285f4,#34a853)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:16}}>G</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:500}}>Google Calendar + Meet</div>
                        <div style={{fontSize:11,color:'#849884'}}>Sincroniza eventos y crea enlaces Meet</div>
                      </div>
                    </div>
                    <span style={{fontSize:10,padding:'3px 9px',borderRadius:10,background:googleStatus.connected?'#e8f5e9':'#fff3e0',color:googleStatus.connected?'#2e7d32':'#b08050',fontWeight:600}}>● {googleStatus.connected?'Conectado':'No conectado'}</span>
                  </div>
                  {googleStatus.connected ? (
                    <>
                      <div style={{fontSize:12,color:'#849884',marginBottom:12,lineHeight:1.5}}>Cuenta: <strong style={{color:'#4e6050'}}>{googleStatus.email}</strong><br/>Zona horaria: America/New_York (Miami). Los eventos confirmados incluyen enlace Meet automático.</div>
                      <button onClick={async()=>{
                        if(!confirm('¿Desconectar Google? Las citas confirmadas seguirán en el calendario pero no se crearán nuevos eventos.')) return;
                        const r = await fetch('/api/google/disconnect',{method:'POST'});
                        if(r.ok){ show('Google desconectado'); setTimeout(()=>window.location.reload(),600); }
                        else { show('Error al desconectar'); }
                      }} style={{...btnS,width:'100%',justifyContent:'center'}}>Desconectar</button>
                    </>
                  ) : (
                    <>
                      <div style={{fontSize:12,color:'#849884',marginBottom:12,lineHeight:1.5}}>Conecta tu cuenta Google para crear eventos + Meet automáticamente al confirmar citas. Usa hora de Miami (America/New_York).</div>
                      <a href="/api/google/connect" style={{...btnP,width:'100%',justifyContent:'center',textDecoration:'none',display:'inline-flex'}}>Conectar con Google</a>
                    </>
                  )}
                </div>

                {/* Email SMTP */}
                <div style={{...CARD,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#0B5394,#1976d2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14}}>@</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:500}}>Correo (SMTP)</div>
                        <div style={{fontSize:11,color:'#849884'}}>Brevo, Mailgun, SES, Zoho… cualquier SMTP</div>
                      </div>
                    </div>
                    <span style={{fontSize:10,padding:'3px 9px',borderRadius:10,background:smtpCfg.host?'#e8f5e9':'#f5f5f5',color:smtpCfg.host?'#2e7d32':'#849884',fontWeight:600}}>● {smtpCfg.host?'Conectado':'Sin configurar'}</span>
                  </div>
                  <Field label="Host"><input style={inp} value={smtpCfg.host} onChange={e=>setSmtpCfg({...smtpCfg,host:e.target.value})} placeholder="smtp-relay.brevo.com"/></Field>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <Field label="Puerto"><input style={inp} type="number" value={smtpCfg.port} onChange={e=>setSmtpCfg({...smtpCfg,port:Number(e.target.value)||587})} placeholder="587"/></Field>
                    <Field label="TLS directo (465)"><select style={sel} value={smtpCfg.secure?'1':'0'} onChange={e=>setSmtpCfg({...smtpCfg,secure:e.target.value==='1'})}><option value="0">No (STARTTLS)</option><option value="1">Sí (SSL)</option></select></Field>
                  </div>
                  <Field label="Usuario"><input style={inp} value={smtpCfg.user} onChange={e=>setSmtpCfg({...smtpCfg,user:e.target.value})} placeholder="login@smtp-brevo.com"/></Field>
                  <Field label="Contraseña / API Key"><input style={inp} type="password" value={smtpCfg.password} onChange={e=>setSmtpCfg({...smtpCfg,password:e.target.value})} placeholder="••••••••"/></Field>
                  <Field label="Remitente (email)"><input style={inp} type="email" value={smtpCfg.from_email} onChange={e=>setSmtpCfg({...smtpCfg,from_email:e.target.value})} placeholder="hola@tudominio.com"/></Field>
                  <Field label="Remitente (nombre)"><input style={inp} value={smtpCfg.from_name} onChange={e=>setSmtpCfg({...smtpCfg,from_name:e.target.value})} placeholder="Lda. Silvana López"/></Field>
                  <button onClick={saveSmtpCfg} style={{...btnP,width:'100%',justifyContent:'center',marginTop:6}}>{I.check} Guardar</button>
                </div>

                {/* Preferencias de notificaciones por correo */}
                <div style={{...CARD,padding:20,gridColumn:'1 / -1'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                    <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#6a8a6a,#4e6050)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:16}}>✉</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:500}}>Notificaciones por correo</div>
                      <div style={{fontSize:11,color:'#849884'}}>Elige qué correos se envían al cliente y a ti</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'#849884',marginBottom:12,padding:'8px 11px',background:'#fafcfa',borderRadius:7,border:'1px dashed #c8ddc8'}}>
                    Desactivar una casilla omite el envío de ese correo. Los correos de restablecimiento de contraseña siempre se envían.
                  </div>
                  <div style={{display:'grid',gap:6}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 90px 90px',fontSize:10,fontWeight:600,color:'#849884',textTransform:'uppercase',letterSpacing:'.4px',padding:'4px 10px'}}>
                      <div>Evento</div>
                      <div style={{textAlign:'center'}}>Cliente</div>
                      <div style={{textAlign:'center'}}>Silvana</div>
                    </div>
                    {Object.entries(emailEventShape).map(([ev,recips]) => (
                      <div key={ev} style={{display:'grid',gridTemplateColumns:'1fr 90px 90px',alignItems:'center',padding:'10px',background:'#fafcfa',borderRadius:8,border:'1px solid #eef3ee'}}>
                        <div style={{fontSize:12,color:'#4e6050'}}>{emailEventLabels[ev]}</div>
                        <div style={{textAlign:'center'}}>
                          {recips.includes('client') ? (
                            <input type="checkbox" checked={!!emailNotifs[ev]?.client} onChange={()=>toggleEmailNotif(ev,'client')} style={{cursor:'pointer',width:16,height:16}}/>
                          ) : <span style={{color:'#c8ddc8'}}>—</span>}
                        </div>
                        <div style={{textAlign:'center'}}>
                          {recips.includes('admin') ? (
                            <input type="checkbox" checked={!!emailNotifs[ev]?.admin} onChange={()=>toggleEmailNotif(ev,'admin')} style={{cursor:'pointer',width:16,height:16}}/>
                          ) : <span style={{color:'#c8ddc8'}}>—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={saveEmailNotifs} style={{...btnP,marginTop:12}}>{I.check} Guardar preferencias</button>
                </div>

                {/* Stripe */}
                <div style={{...CARD,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#635bff,#4a45c0)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,fontStyle:'italic'}}>S</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:500}}>Stripe</div>
                        <div style={{fontSize:11,color:'#849884'}}>Enlaces de pago con tarjeta</div>
                      </div>
                    </div>
                    {(() => {
                      const stripeMet = metodos.find((m:any)=>m.tipo==='Stripe');
                      const connected = !!(stripeMet?.claveSecreta);
                      return <span style={{fontSize:10,padding:'3px 9px',borderRadius:10,background:connected?'#e8f5e9':'#f5f5f5',color:connected?'#2e7d32':'#849884',fontWeight:600}}>● {connected?'Conectado':'Sin configurar'}</span>;
                    })()}
                  </div>
                  <div style={{fontSize:12,color:'#849884',marginBottom:12,lineHeight:1.5}}>Las credenciales se gestionan en <strong>Métodos de Pago</strong> al editar el método de tipo Stripe.</div>
                  <button onClick={()=>setSection('pagos')} style={{...btnS,width:'100%',justifyContent:'center'}}>Ir a Métodos de Pago →</button>
                </div>

                {/* PayPal */}
                <div style={{...CARD,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#0070ba,#003087)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12,fontStyle:'italic',letterSpacing:'-0.5px'}}>PP</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:500}}>PayPal</div>
                        <div style={{fontSize:11,color:'#849884'}}>Pagos internacionales (+recargo)</div>
                      </div>
                    </div>
                    {(() => {
                      const ppMet = metodos.find((m:any)=>m.tipo==='PayPal');
                      const connected = !!(ppMet?.claveSecreta);
                      return <span style={{fontSize:10,padding:'3px 9px',borderRadius:10,background:connected?'#e8f5e9':'#f5f5f5',color:connected?'#2e7d32':'#849884',fontWeight:600}}>● {connected?'Conectado':'Sin configurar'}</span>;
                    })()}
                  </div>
                  <div style={{fontSize:12,color:'#849884',marginBottom:12,lineHeight:1.5}}>Las credenciales se gestionan en <strong>Métodos de Pago</strong> al editar el método de tipo PayPal.</div>
                  <button onClick={()=>setSection('pagos')} style={{...btnS,width:'100%',justifyContent:'center'}}>Ir a Métodos de Pago →</button>
                </div>

                {/* WhatsApp */}
                <div style={{...CARD,padding:20,gridColumn:'1 / -1'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#25d366,#128c7e)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:18}}>✓</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:500}}>WhatsApp (enlaces directos)</div>
                        <div style={{fontSize:11,color:'#849884'}}>Sin API — usa wa.me con mensajes pre-rellenados</div>
                      </div>
                    </div>
                    <span style={{fontSize:10,padding:'3px 9px',borderRadius:10,background:'#e8f5e9',color:'#2e7d32',fontWeight:600}}>● Listo</span>
                  </div>
                  <div style={{fontSize:12,color:'#849884',marginBottom:14,lineHeight:1.5,padding:'10px 12px',background:'#f5f9f5',borderRadius:8,borderLeft:'3px solid #4a7a4a'}}>
                    Desde el detalle de cada cita podrás abrir WhatsApp (web/desktop/móvil) con el mensaje listo. Si el teléfono no tiene formato válido, te mostraremos el mensaje para copiar/pegar manualmente.
                  </div>

                  {/* Template editor */}
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:'#4e6050'}}>Plantillas por evento</div>
                    <div style={{fontSize:11,color:'#849884',marginBottom:10,padding:'8px 11px',background:'#fafcfa',borderRadius:7,border:'1px dashed #c8ddc8'}}>
                      Variables disponibles: {WA_TEMPLATE_VARS.map(v => <code key={v.key} style={{background:'#fff',padding:'1px 6px',borderRadius:4,marginRight:4,color:'#4a7a4a',fontSize:10}}>{'{'+v.key+'}'}</code>)}
                    </div>
                    <div style={{display:'grid',gap:12}}>
                      {WA_TEMPLATE_EVENTS.map(evt => (
                        <div key={evt}>
                          <div style={{fontSize:11,fontWeight:600,color:'#4e6050',marginBottom:4,textTransform:'uppercase',letterSpacing:'.4px'}}>{WA_TEMPLATE_LABELS[evt]}</div>
                          <textarea
                            style={{...inp,minHeight:62,resize:'vertical',fontFamily:'inherit',fontSize:12,lineHeight:1.5}}
                            value={waTpls[evt] || ''}
                            onChange={e=>setWaTpls({...waTpls,[evt]:e.target.value})}
                            placeholder="Mensaje..."
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={saveWaTpls} style={{...btnP,marginTop:12}}>{I.check} Guardar plantillas</button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CONFIGURACIÓN */}
          {section === 'config' && (
            <div style={{animation:'slideIn .3s',display:'grid',gap:16,maxWidth:640}}>

              {/* Nickname */}
              <div style={{...CARD,padding:24}}>
                <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 16px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>{I.user} Nombre para mostrar</h3>
                <Field label="Cómo quieres que te llamemos">
                  <input style={inp} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="Tu nombre o apodo"/>
                </Field>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                  <p style={{fontSize:12,color:'#849884',margin:0,fontWeight:300}}>Se usa en el saludo del panel de inicio y en la barra lateral.</p>
                  <button onClick={async ()=>{try{await updateNickname(nickname);show('Nombre guardado')}catch(e){show('Error al guardar')}}} style={btnP}>{I.check} Guardar</button>
                </div>
              </div>

              {/* Contact info for public page */}
              <div style={{...CARD,padding:24}}>
                <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 4px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Datos de contacto público
                </h3>
                <p style={{fontSize:12,color:'#849884',margin:'0 0 14px',fontWeight:300}}>Se muestran en la sección de contacto de la página principal.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
                  <Field label="Email de contacto"><input style={inp} type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} placeholder="consultas@correo.com"/></Field>
                  <Field label="WhatsApp / Teléfono"><input style={inp} value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="+54 9 11 0000-0000"/></Field>
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
                  <button onClick={async ()=>{try{await updateContactInfo({contact_email:contactEmail,contact_phone:contactPhone});show('Datos de contacto guardados')}catch(e){show('Error al guardar')}}} style={btnP}>{I.check} Guardar</button>
                </div>
              </div>

              {/* Dark / Light mode */}
              <div style={{...CARD,padding:24}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 4px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>
                      {darkMode
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      }
                      Apariencia
                    </h3>
                    <p style={{fontSize:13,color:'#849884',margin:0,fontWeight:300}}>{darkMode ? 'Modo oscuro activado' : 'Modo claro activado'}</p>
                  </div>
                  <button onClick={()=>{setDarkMode(!darkMode);show(darkMode?'Modo claro':'Modo oscuro')}} style={{
                    width:56,height:30,borderRadius:15,border:'none',cursor:'pointer',position:'relative',transition:'background .3s',
                    background:darkMode?'#4a7a4a':'#c8ddc8'
                  }}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:darkMode?29:3,transition:'left .3s',boxShadow:'0 1px 4px rgba(0,0,0,.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {darkMode
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a7a4a" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c4956a" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/></svg>
                      }
                    </div>
                  </button>
                </div>
              </div>

              {/* Seguridad de la cuenta */}
              <div style={{...CARD,padding:24}}>
                <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 4px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>
                  {I.lock} Seguridad de la cuenta
                </h3>
                <p style={{fontSize:12,color:'#849884',margin:'0 0 16px',fontWeight:300}}>Gestiona tu correo, contraseña y métodos de recuperación.</p>

                {/* Email */}
                <div style={{padding:'14px 16px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2'),display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                    <span style={{color:'#4a7a4a',flexShrink:0}}>{I.mail}</span>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>Correo principal</div>
                      <div style={{fontSize:13,fontWeight:400,overflow:'hidden',textOverflow:'ellipsis'}}>{secEmail}</div>
                    </div>
                  </div>
                  <button onClick={()=>{setSecNewEmail('');setSecEditModal('email')}} style={{...btnS,fontSize:11,padding:'6px 12px',flexShrink:0}}>{I.edit} Cambiar</button>
                </div>

                {/* Password */}
                <div style={{padding:'14px 16px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2'),display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{color:'#4a7a4a'}}>{I.lock}</span>
                    <div>
                      <div style={{fontSize:11,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>Contraseña</div>
                      <div style={{fontSize:13,fontWeight:400,fontFamily:'monospace'}}>••••••••••••</div>
                    </div>
                  </div>
                  <button onClick={()=>{setSecPwd({current:'',new1:'',new2:''});setSecEditModal('password')}} style={{...btnS,fontSize:11,padding:'6px 12px'}}>{I.edit} Cambiar</button>
                </div>

                {/* Recovery header */}
                <div style={{marginTop:18,marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,height:1,background:dm?'#333':'#e2ede2'}}/>
                  <span style={{fontSize:10,color:'#849884',fontWeight:600,textTransform:'uppercase',letterSpacing:'.8px'}}>Recuperación de cuenta</span>
                  <div style={{flex:1,height:1,background:dm?'#333':'#e2ede2'}}/>
                </div>

                {/* Recovery email */}
                <div style={{padding:'14px 16px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2'),display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                    <span style={{color:'#4a7a4a',flexShrink:0}}>{I.mail}</span>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>Correo de recuperación</div>
                      <div style={{fontSize:13,fontWeight:400,overflow:'hidden',textOverflow:'ellipsis'}}>{recoveryEmail||'No configurado'}</div>
                    </div>
                  </div>
                  <button onClick={()=>setSecEditModal('recovery')} style={{...btnS,fontSize:11,padding:'6px 12px',flexShrink:0}}>{I.edit} Editar</button>
                </div>

                {/* Security question */}
                <div style={{padding:'14px 16px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2'),display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                    <span style={{color:'#4a7a4a',flexShrink:0}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </span>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,color:'#849884',fontWeight:500,textTransform:'uppercase',letterSpacing:'.4px'}}>Pregunta de seguridad</div>
                      <div style={{fontSize:13,fontWeight:400,overflow:'hidden',textOverflow:'ellipsis'}}>{secQuestion}</div>
                    </div>
                  </div>
                  <button onClick={()=>setSecEditModal('question')} style={{...btnS,fontSize:11,padding:'6px 12px',flexShrink:0}}>{I.edit} Editar</button>
                </div>

              </div>

              {/* Change email modal */}
              <Modal dark={dm} open={secEditModal==='email'} onClose={()=>setSecEditModal(null)} title="Cambiar correo de acceso" width={440}>
                <Field label="Correo actual"><input style={{...inp,opacity:.6}} value={secEmail} disabled/></Field>
                <Field label="Nuevo correo"><input style={inp} type="email" value={secNewEmail} onChange={e=>setSecNewEmail(e.target.value)} placeholder="nuevo@correo.com"/></Field>
                <p style={{fontSize:12,color:'#849884',margin:'0 0 14px',fontWeight:300}}>El correo de acceso se actualizará inmediatamente. Usarás el nuevo correo para iniciar sesión.</p>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setSecEditModal(null)} style={btnS}>Cancelar</button>
                  <button onClick={async()=>{if(!secNewEmail||!secNewEmail.includes('@'))return show('Ingresa un correo válido');try{const res=await updateAuthEmail(secNewEmail);if(res.success){setSecEmail(secNewEmail);setSecNewEmail('');setSecEditModal(null);show('Correo de acceso actualizado')}else{show(res.error||'Error al cambiar correo')}}catch(e){show('Error al cambiar correo')}}} style={btnP}>{I.check} Cambiar correo</button>
                </div>
              </Modal>

              {/* Change password modal */}
              <Modal dark={dm} open={secEditModal==='password'} onClose={()=>setSecEditModal(null)} title="Cambiar contraseña" width={440}>
                <Field label="Contraseña actual"><div style={{position:'relative'}}><input style={{...inp,paddingRight:36}} type={showPwd.current?'text':'password'} value={secPwd.current} onChange={e=>setSecPwd({...secPwd,current:e.target.value})} placeholder="••••••••"/><button type="button" onClick={()=>setShowPwd(p=>({...p,current:!p.current}))} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'#849884',display:'flex',padding:2}}>{showPwd.current?I.eyeOff:I.eye}</button></div></Field>
                <Field label="Nueva contraseña"><div style={{position:'relative'}}><input style={{...inp,paddingRight:36}} type={showPwd.new1?'text':'password'} value={secPwd.new1} onChange={e=>setSecPwd({...secPwd,new1:e.target.value})} placeholder="Mínimo 8 caracteres"/><button type="button" onClick={()=>setShowPwd(p=>({...p,new1:!p.new1}))} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'#849884',display:'flex',padding:2}}>{showPwd.new1?I.eyeOff:I.eye}</button></div></Field>
                <Field label="Confirmar nueva contraseña"><div style={{position:'relative'}}><input style={{...inp,paddingRight:36}} type={showPwd.new2?'text':'password'} value={secPwd.new2} onChange={e=>setSecPwd({...secPwd,new2:e.target.value})} placeholder="Repite la contraseña"/><button type="button" onClick={()=>setShowPwd(p=>({...p,new2:!p.new2}))} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'#849884',display:'flex',padding:2}}>{showPwd.new2?I.eyeOff:I.eye}</button></div></Field>
                {secPwd.new1 && secPwd.new2 && secPwd.new1!==secPwd.new2 && <p style={{fontSize:12,color:'#C62828',margin:'0 0 10px'}}>Las contraseñas no coinciden</p>}
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setSecEditModal(null)} style={btnS}>Cancelar</button>
                  <button onClick={async()=>{if(!secPwd.current||!secPwd.new1||secPwd.new1!==secPwd.new2)return;const res=await updateAuthPassword(secPwd.current,secPwd.new1);if(res.success){setSecEditModal(null);setSecPwd({current:'',new1:'',new2:''});show('Contraseña actualizada')}else{show(res.error||'Error al cambiar contraseña')}}} style={btnP}>{I.check} Actualizar</button>
                </div>
              </Modal>

              {/* Recovery email modal */}
              <Modal dark={dm} open={secEditModal==='recovery'} onClose={()=>setSecEditModal(null)} title="Correo de recuperación" width={440}>
                <p style={{fontSize:13,color:'#4e6050',margin:'0 0 14px',fontWeight:300,lineHeight:1.5}}>Este correo se usará solo si pierdes acceso a tu cuenta principal. Debe ser diferente al correo principal.</p>
                <Field label="Correo de recuperación"><input style={inp} type="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)} placeholder="backup@correo.com"/></Field>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setSecEditModal(null)} style={btnS}>Cancelar</button>
                  <button onClick={()=>{setSecEditModal(null);show('Correo de recuperación guardado')}} style={btnP}>{I.check} Guardar</button>
                </div>
              </Modal>

              {/* Security question modal */}
              <Modal dark={dm} open={secEditModal==='question'} onClose={()=>setSecEditModal(null)} title="Pregunta de seguridad" width={460}>
                <p style={{fontSize:13,color:'#4e6050',margin:'0 0 14px',fontWeight:300,lineHeight:1.5}}>Elige una pregunta y una respuesta que solo tú conozcas. Se usará para verificar tu identidad en la recuperación de cuenta.</p>
                <Field label="Pregunta">
                  <select style={sel} value={secQuestion} onChange={e=>setSecQuestion(e.target.value)}>
                    <option>¿Nombre de tu primera mascota?</option>
                    <option>¿País donde naciste?</option>
                    <option>¿Nombre de tu mejor amigo de la infancia?</option>
                    <option>¿Modelo de tu primer auto?</option>
                    <option>¿Apellido de soltera de tu madre?</option>
                    <option>¿Nombre de tu escuela primaria?</option>
                    <option>¿Tu comida favorita de niñez?</option>
                  </select>
                </Field>
                <Field label="Respuesta"><div style={{position:'relative'}}><input style={{...inp,paddingRight:36}} type={showPwd.answer?'text':'password'} value={secAnswer} onChange={e=>setSecAnswer(e.target.value)} placeholder="Tu respuesta"/><button type="button" onClick={()=>setShowPwd(p=>({...p,answer:!p.answer}))} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'#849884',display:'flex',padding:2}}>{showPwd.answer?I.eyeOff:I.eye}</button></div></Field>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setSecEditModal(null)} style={btnS}>Cancelar</button>
                  <button onClick={async ()=>{setSecEditModal(null);show('Pregunta de seguridad guardada');try{await updateSecurityQuestion(secQuestion,secAnswer)}catch(e){show('Error al guardar')}}} style={btnP}>{I.check} Guardar</button>
                </div>
              </Modal>

              {/* Notepad */}
              <div style={{...CARD,padding:24}}>
                <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 4px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Nota rápida
                </h3>
                <p style={{fontSize:12,color:'#849884',margin:'0 0 12px',fontWeight:300}}>Un espacio para recordatorios personales. Solo tú puedes verlo.</p>
                <textarea
                  style={{...inp,minHeight:100,resize:'vertical',lineHeight:1.6,fontSize:13}}
                  value={notepad}
                  onChange={e=>setNotepad(e.target.value)}
                  onBlur={async ()=>{try{await updateNotepad(notepad);show('Nota guardada')}catch(e){show('Error al guardar nota')}}}
                  placeholder="Escribe algo que quieras recordar..."
                />
              </div>

              {/* Tutorial links */}
              <div style={{...CARD,padding:24}}>
                <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 4px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  Tutoriales y enlaces útiles
                </h3>
                <p style={{fontSize:12,color:'#849884',margin:'0 0 14px',fontWeight:300}}>Guarda enlaces que te sean útiles para consulta rápida.</p>

                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                  {tutorialLinks.map(link => (
                    <div key={link.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px solid '+(dm?'#333':'#e2ede2')}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{link.title}</div>
                        <div style={{fontSize:11,color:'#4a7a4a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{link.url}</div>
                      </div>
                      <div style={{display:'flex',gap:6,marginLeft:10,flexShrink:0}}>
                        <button onClick={()=>{const u=link.url.match(/^https?:\/\//)?link.url:'https://'+link.url;window.open(u,'_blank')}} style={{border:'none',background:'#e2ede2',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#4a7a4a'}}>{I.eye}</button>
                        <button onClick={async ()=>{setTutorialLinks(p=>p.filter(l=>l.id!==link.id));show('Enlace eliminado');try{await deleteAdminLink(link.id)}catch(e){show('Error al eliminar enlace')}}} style={{border:'none',background:'#FFEBEE',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#C62828'}}>{I.trash}</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new link */}
                <div style={{padding:'14px',background:dm?'#1a1a1a':'#f0f5f0',borderRadius:10,border:'1px dashed '+(dm?'#444':'#c8ddc8')}}>
                  <div style={{fontSize:11,fontWeight:500,color:'#849884',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Agregar enlace</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <input style={{...inp,fontSize:12}} value={newLink.title} onChange={e=>setNewLink({...newLink,title:e.target.value})} placeholder="Título"/>
                    <input style={{...inp,fontSize:12}} value={newLink.url} onChange={e=>setNewLink({...newLink,url:e.target.value})} placeholder="https://..."/>
                  </div>
                  <button onClick={async ()=>{
                    if(!newLink.title||!newLink.url) return;
                    const tmpId = 'tmp-'+Date.now();
                    setTutorialLinks(p=>[...p,{id:tmpId,...newLink}]);
                    setNewLink({title:'',url:''});
                    show('Enlace agregado');
                    try{await upsertAdminLink({title:newLink.title,url:newLink.url})}catch(e){show('Error al guardar enlace')}
                  }} style={{...btnP,fontSize:12,padding:'7px 16px'}}>{I.plus} Agregar</button>
                </div>
              </div>

              {/* Logout */}
              <div style={{...CARD,padding:24}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <h3 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:17,margin:'0 0 4px',display:'flex',alignItems:'center',gap:8,fontWeight:400}}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sesión
                    </h3>
                    <p style={{fontSize:12,color:'#849884',margin:0,fontWeight:300}}>Cerrar sesión en este dispositivo</p>
                  </div>
                  <button onClick={()=>setLogoutConfirm(true)} style={{padding:'9px 20px',borderRadius:10,border:'1.5px solid #c8ddc8',background:'#fdfcfa',color:'#C62828',fontWeight:500,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:7}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Cerrar sesión
                  </button>
                </div>
              </div>

              {/* Logout confirm modal */}
              <Modal dark={dm} open={logoutConfirm} onClose={()=>setLogoutConfirm(false)} title="Cerrar sesión" width={380}>
                <p style={{fontSize:14,color:'#4e6050',margin:'0 0 18px',lineHeight:1.6,fontWeight:300}}>Estás a punto de cerrar tu sesión. Tendrás que volver a iniciar sesión para acceder al panel.</p>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setLogoutConfirm(false)} style={btnS}>Cancelar</button>
                  <button onClick={async ()=>{setLogoutConfirm(false);show('Cerrando sesión...');await logoutAction();}} style={{...btnP,background:'linear-gradient(135deg,#C62828,#B71C1C)'}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sí, cerrar sesión
                  </button>
                </div>
              </Modal>
            </div>
          )}

        </div>
      </main>

      {/* WhatsApp fallback modal — shown when phone is unformattable */}
      <Modal dark={dm} open={waPicker.open} onClose={()=>setWaPicker({open:false,booking:null,event:'custom'})} title="Copiar mensaje de WhatsApp" width={520}>
        {waPicker.booking && (() => {
          const msg = buildWaMessageFor(waPicker.booking, waPicker.event);
          return (
            <div>
              <div style={{fontSize:12,color:'#b08050',background:'#fff8e1',padding:'10px 12px',borderRadius:8,marginBottom:12,border:'1px solid #ffe0b2',lineHeight:1.5}}>
                El número <strong>{waPicker.booking.telefono || '(vacío)'}</strong> no tiene formato internacional válido. Copia el mensaje y pégalo manualmente en WhatsApp, o corrige el teléfono en la cita.
              </div>
              <Field label={`Plantilla: ${WA_TEMPLATE_LABELS[waPicker.event] || waPicker.event}`}>
                <select style={sel} value={waPicker.event} onChange={e=>setWaPicker({...waPicker,event:e.target.value})}>
                  {WA_TEMPLATE_EVENTS.map(evt => <option key={evt} value={evt}>{WA_TEMPLATE_LABELS[evt]}</option>)}
                </select>
              </Field>
              <Field label="Mensaje">
                <textarea style={{...inp,minHeight:120,resize:'vertical',fontFamily:'inherit',fontSize:13}} value={msg} readOnly onFocus={e=>e.target.select()}/>
              </Field>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:10}}>
                <button onClick={()=>setWaPicker({open:false,booking:null,event:'custom'})} style={btnS}>Cerrar</button>
                <button onClick={async()=>{try{await navigator.clipboard.writeText(msg);show('Mensaje copiado');}catch{show('No se pudo copiar');}}} style={btnP}>{I.check} Copiar al portapapeles</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {toast && (
        <div style={{position:'fixed',bottom:22,left:'50%',transform:'translateX(-50%)',background:'#2a3528',color:'#f0f5f0',padding:'10px 20px',borderRadius:12,fontSize:13,fontWeight:500,boxShadow:'0 6px 24px rgba(42,53,40,.25)',zIndex:2000,display:'flex',alignItems:'center',gap:8,animation:'toastIn .22s',fontFamily:"'DM Sans',sans-serif"}}>
          <span style={{color:'#8fb08f'}}>{I.check}</span>{toast}
        </div>
      )}
    </div>
  );
}
