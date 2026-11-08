// THE HOPE JAMB & WAEC TUTORIAL
// 1) Create a Supabase project.
// 2) Paste your Project URL and anon/public key below.
// Never put your Supabase service_role key in this file.
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";
const MONTHLY_FEE_NAIRA = 1500;
const ACCOUNT_NUMBER = "9071236941";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
let authMode = "signup";
let currentUser = null;
let currentProfile = null;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}
function setMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#a33" : "#087443";
}
function requireSupabase() {
  if (!supabase) {
    toast("Connect Supabase first. Follow the setup guide in README.md.");
    return false;
  }
  return true;
}
function openAuth(mode = "signup", course = null) {
  authMode = mode;
  $("authModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (course) $("course").value = course;
  updateAuthMode();
}
function closeAuth() {
  $("authModal").classList.add("hidden");
  document.body.style.overflow = "";
  setMessage("authMessage", "");
}
function updateAuthMode() {
  const signup = authMode === "signup";
  $("authTitle").textContent = signup ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = signup ? "Join the tutorial community." : "Log in to your student portal.";
  $("nameField").classList.toggle("hidden", !signup);
  $("courseField").classList.toggle("hidden", !signup);
  $("fullName").required = signup;
  $("course").required = signup;
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("authSubmit").textContent = signup ? "Create account" : "Log in";
  $("signupTab").classList.toggle("active", signup);
  $("loginTab").classList.toggle("active", !signup);
  setMessage("authMessage", "");
}
function showDashboard(show) {
  $("dashboard").classList.toggle("hidden", !show);
  document.querySelector(".hero").classList.toggle("hidden", show);
  document.querySelector(".trust-strip").classList.toggle("hidden", show);
  document.querySelector(".programmes").classList.toggle("hidden", show);
  document.querySelector(".about-section").classList.toggle("hidden", show);
  document.querySelector(".payment-section").classList.toggle("hidden", show);
  document.querySelector(".cta-section").classList.toggle("hidden", show);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function loadProfile() {
  if (!currentUser) return;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  if (error) console.error("Profile load:", error.message);
  currentProfile = data || null;
  $("studentName").textContent = currentProfile?.full_name || currentUser.email?.split("@")[0] || "Student";
  $("studentCourse").textContent = currentProfile?.course || "Not selected";
  $("paymentCourse").value = currentProfile?.course || "JAMB";
  $("adminPanel").classList.toggle("hidden", !currentProfile?.is_admin);
  showDashboard(true);
  await loadPaymentHistory();
  if (currentProfile?.is_admin) await loadAdminPayments();
}
async function loadPaymentHistory() {
  const { data, error } = await supabase.from("payment_submissions")
    .select("id,course,amount_kobo,payment_month,status,created_at,admin_note")
    .eq("student_id", currentUser.id).order("created_at", { ascending: false });
  if (error) {
    $("paymentHistory").innerHTML = '<p class="muted">Could not load payment history.</p>';
    console.error(error.message); return;
  }
  const latest = data?.[0];
  $("paymentStatus").textContent = latest ? titleCase(latest.status) : "Not submitted";
  $("paymentStatusHelp").textContent = latest ? `Latest submission: ${latest.payment_month}` : "Submit your payment details below.";
  $("paymentHistory").innerHTML = data?.length ? data.map(p => `
    <div class="history-item">
      <div><strong>${escapeHtml(p.course)}</strong><br><span class="muted">${escapeHtml(p.payment_month)} · ₦${(p.amount_kobo/100).toLocaleString("en-NG")}</span>${p.admin_note ? `<br><span class="muted">${escapeHtml(p.admin_note)}</span>` : ""}</div>
      <span class="status-pill ${statusClass(p.status)}">${titleCase(p.status)}</span>
    </div>`).join("") : '<p class="muted">No payment submissions yet.</p>';
}
async function submitAuth(event) {
  event.preventDefault();
  if (!requireSupabase()) return;
  const email = $("email").value.trim();
  const password = $("password").value;
  $("authSubmit").disabled = true;
  try {
    if (authMode === "signup") {
      const fullName = $("fullName").value.trim();
      const course = $("course").value;
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, course } }
      });
      if (error) throw error;
      if (data.session) {
        currentUser = data.user;
        closeAuth();
        await loadProfile();
        toast("Account created. Welcome to The Hope!");
      } else {
        setMessage("authMessage", "Registration received. Check your email to confirm your account, then log in.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      closeAuth();
      await loadProfile();
      toast("You are now logged in.");
    }
  } catch (err) {
    setMessage("authMessage", err.message || "Something went wrong. Please try again.", true);
  } finally {
    $("authSubmit").disabled = false;
  }
}
async function submitPayment(event) {
  event.preventDefault();
  if (!requireSupabase()) return;
  if (!currentUser) { openAuth("login"); return; }
  const reference = $("paymentReference").value.trim();
  const month = $("paymentMonth").value;
  const course = $("paymentCourse").value;
  const file = $("receiptFile").files[0];
  if (!reference || !month) return setMessage("paymentMessage", "Enter the transfer reference and payment month.", true);
  if (file && file.size > 5 * 1024 * 1024) return setMessage("paymentMessage", "Receipt must be 5 MB or smaller.", true);
  $("paymentSubmit").disabled = true;
  setMessage("paymentMessage", "Submitting your payment for review…");
  try {
    let receiptPath = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      receiptPath = `${currentUser.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(receiptPath, file, {
        upsert: false, contentType: file.type || "application/octet-stream"
      });
      if (uploadError) throw uploadError;
    }
    const { error } = await supabase.from("payment_submissions").insert({
      student_id: currentUser.id,
      course,
      amount_kobo: MONTHLY_FEE_NAIRA * 100,
      payment_month: `${month}-01`,
      transfer_reference: reference,
      receipt_path: receiptPath
    });
    if (error) throw error;
    $("paymentForm").reset();
    $("paymentMonth").value = new Date().toISOString().slice(0,7);
    setMessage("paymentMessage", "Submitted successfully. Your payment is pending administrator verification.");
    await loadPaymentHistory();
    if (currentProfile?.is_admin) await loadAdminPayments();
  } catch (err) {
    setMessage("paymentMessage", err.message || "Unable to submit payment. Please try again.", true);
  } finally {
    $("paymentSubmit").disabled = false;
  }
}
function titleCase(s) { return (s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function statusClass(s) { return s === "approved" ? "status-approved" : s === "rejected" ? "status-rejected" : ""; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function loadAdminPayments() {
  const { data, error } = await supabase.from("payment_submissions")
    .select("id,student_id,course,amount_kobo,payment_month,transfer_reference,receipt_path,status,created_at,profiles(full_name,email)")
    .order("created_at", { ascending: false });
  if (error) {
    $("adminPayments").textContent = "Could not load submissions. Check the SQL policies in README.md.";
    console.error(error.message); return;
  }
  if (!data?.length) { $("adminPayments").innerHTML = '<p class="muted">No payment submissions yet.</p>'; return; }
  $("adminPayments").innerHTML = data.map(p => `
    <div class="admin-item">
      <div><strong>${escapeHtml(p.profiles?.full_name || p.profiles?.email || "Student")}</strong><br>
      <span class="muted">${escapeHtml(p.course)} · ${escapeHtml(p.payment_month)} · ₦${(p.amount_kobo/100).toLocaleString("en-NG")}</span><br>
      <span class="muted">Ref: ${escapeHtml(p.transfer_reference)} · ${titleCase(p.status)}</span>
      ${p.receipt_path ? `<br><button class="text-link" data-receipt="${escapeHtml(p.receipt_path)}">View receipt</button>` : ""}</div>
      ${p.status === "pending" ? `<div class="admin-actions"><button class="approve-btn" data-review="${p.id}" data-status="approved">Approve</button><button class="reject-btn" data-review="${p.id}" data-status="rejected">Reject</button></div>` : ""}
    </div>`).join("");
}
async function reviewPayment(id, status) {
  const note = status === "approved" ? "Payment confirmed by administrator." : "Payment not confirmed. Please contact the tutorial administrator.";
  const { error } = await supabase.from("payment_submissions")
    .update({ status, admin_note: note, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) { toast("Could not update payment status."); console.error(error.message); return; }
  toast(`Payment ${status}.`);
  await loadAdminPayments();
}
async function viewReceipt(path) {
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
  if (error) { toast("Could not open receipt."); return; }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
async function logout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null; currentProfile = null;
  showDashboard(false); toast("You have logged out.");
}

document.addEventListener("DOMContentLoaded", async () => {
  $("year").textContent = new Date().getFullYear();
  $("paymentMonth").value = new Date().toISOString().slice(0,7);
  document.querySelectorAll("[data-open-auth]").forEach(b => b.addEventListener("click", () => openAuth(b.dataset.openAuth)));
  document.querySelectorAll("[data-close-modal]").forEach(b => b.addEventListener("click", closeAuth));
  document.querySelectorAll("[data-select-course]").forEach(b => b.addEventListener("click", () => openAuth("signup", b.dataset.selectCourse)));
  $("signupTab").addEventListener("click", () => { authMode = "signup"; updateAuthMode(); });
  $("loginTab").addEventListener("click", () => { authMode = "login"; updateAuthMode(); });
  $("authForm").addEventListener("submit", submitAuth);
  $("paymentForm").addEventListener("submit", submitPayment);
  $("logoutBtn").addEventListener("click", logout);
  $("copyAccount").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(ACCOUNT_NUMBER); toast("OPay account number copied."); }
    catch { toast(`OPay account number: ${ACCOUNT_NUMBER}`); }
  });
  $("menuToggle").addEventListener("click", () => $("mainNav").classList.toggle("open"));
  $("mainNav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("mainNav").classList.remove("open")));
  $("adminPayments").addEventListener("click", async e => {
    const review = e.target.closest("[data-review]");
    const receipt = e.target.closest("[data-receipt]");
    if (review) await reviewPayment(review.dataset.review, review.dataset.status);
    if (receipt) await viewReceipt(receipt.dataset.receipt);
  });

  if (!configured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) { currentUser = session.user; await loadProfile(); }
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) { currentUser = null; currentProfile = null; showDashboard(false); }
  });
});
