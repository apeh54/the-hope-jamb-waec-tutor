# THE HOPE JAMB & WAEC TUTORIAL

A responsive tutorial website starter with student registration/login, a student dashboard, monthly payment submission, receipt upload and an admin payment-review area.

## Included files

- `index.html` — website structure and pages
- `styles.css` — responsive green, yellow and white design
- `app.js` — Supabase authentication, dashboard and payment workflow
- `supabase-setup.sql` — database tables, security policies and private receipt storage

## Tutorial fee and payment details currently configured

- Monthly fee: **₦1,500**
- OPay account number: **9071236941**
- Account name: **Oluwatomisin Hephzibah Apeh**

The website currently treats ₦1,500 as the monthly fee for the selected programme (JAMB, WAEC or Both). If you intend a different fee arrangement, update the amount and the matching SQL constraint before accepting payments.

---

## A. Create and configure Supabase

1. Visit https://supabase.com and create a project.
2. In your Supabase project, open **SQL Editor**.
3. Open `supabase-setup.sql`, copy all its contents and run it.
4. Open **Project Settings → API** (or **Data API / API Keys**, depending on the dashboard version).
5. Copy the **Project URL** and the **anon / publishable key**. These are designed for browser use with Row Level Security enabled.
6. Open `app.js` and replace:

```js
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";
```

Do not use or publish the `service_role` / secret key.

### Email confirmation

Supabase may ask new students to confirm their email. Configure the site's deployed URL under **Authentication → URL Configuration** and set the Site URL to your Vercel website URL. Add your local preview and deployed domains to the allowed redirect URLs if needed.

## B. Make yourself the website administrator

1. Register on your deployed website using the email address you want to use as the administrator.
2. Confirm your email if Supabase requires it, then log in once.
3. In Supabase → SQL Editor, run this command, replacing the email with your exact login email:

```sql
update public.profiles
set is_admin = true
where email = 'your-email@example.com';
```

4. Log out and log in again. Your dashboard will now show the Admin Payment Review section.

Only do this for an account you control. Never allow students to set their own `is_admin` value.

## C. Publish with GitHub and Vercel

1. Open your GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, `supabase-setup.sql` and `README.md` to the repository's root (not inside another nested folder).
3. Commit the files.
4. Visit https://vercel.com and sign in with GitHub.
5. Choose **Add New → Project**, import `the-hope-jamb-waec-tutorial`, then click **Deploy**.
6. Vercel should detect this as a static website. No build command is required; the output directory can be left blank or set to `.`.
7. Copy the Vercel URL and add it to Supabase Authentication URL Configuration.

## D. How the payment flow works

1. Student creates an account and chooses JAMB, WAEC or Both.
2. Student transfers ₦1,500 to the OPay account shown on the website.
3. Student logs in and submits the payment month, transfer reference and (optionally) a receipt file.
4. The submission is marked **Pending**.
5. The administrator checks the transfer in the OPay account and approves or rejects the submission.
6. The student sees the updated status in their dashboard.

**Important:** This starter records and reviews payments; it does not automatically verify an OPay transfer or automatically unlock protected lesson files. Always confirm the money has arrived in your OPay account before approving. Before offering paid-only lessons, add server-side access checks or a protected course platform so students cannot access paid content just by opening a public URL.

## E. Test before sharing the site

- Create a test student account.
- Confirm the profile is created in Supabase.
- Submit a test payment entry (do not make a real transfer just for testing).
- Confirm the submission appears in Supabase and the student dashboard.
- Promote your own account to admin and test approve/reject using a test submission.
- Test the site on a phone and a computer.

## Troubleshooting

- **"Connect Supabase first"** — the URL/key placeholders in `app.js` have not been replaced.
- **Registration says email confirmation required** — check your email, confirm the account, then log in.
- **Profile is missing** — confirm `supabase-setup.sql` ran successfully and inspect Supabase Auth and Table Editor.
- **Admin area does not appear** — run the admin SQL update for your exact email, then log out and back in.
- **Receipt upload fails** — confirm the `payment-proofs` bucket and storage policies were created by the SQL script.

This is a starter website, not a payment gateway or a substitute for checking transfers directly in your OPay account.
