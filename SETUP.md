# Anime Friends Matcher — setup guide

This is a starter project, not yet a deployed/live website. It includes your 10 supplied One Piece images, a mobile-friendly matching board, a themed JPG result card, and a Supabase connection point. Jujutsu Kaisen is marked as coming soon until you supply its character images.

## What you'll need
- A computer/laptop is easiest.
- A free Supabase account: https://supabase.com
- A GitHub account: https://github.com
- A Vercel account: https://vercel.com
- Node.js LTS installed locally if you want to test on your computer.

## 1. Create Supabase project
1. Create a new project in Supabase.
2. Open **SQL Editor**.
3. Paste and run the contents of `supabase/schema.sql`.
4. In **Storage**, create a bucket named `friend-photos` and set it to **Public** for this prototype.
5. In **Project Settings → API**, copy the Project URL and the anon/publishable key.
6. Copy `.env.example` to a new file named `.env` and replace the placeholder values:
   VITE_SUPABASE_URL=your project URL
   VITE_SUPABASE_ANON_KEY=your anon/publishable key
   Never put a service-role key in the frontend.

## 2. Test locally
Install Node.js LTS, open a terminal in this project folder, then run:
```bash
npm install
npm run dev
```
Open the local address Vite prints.

## 3. Deploy
1. Create a GitHub repository and upload the project files.
2. In Vercel, import that repository.
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings.
4. Deploy.
5. In Vercel, configure a rewrite so `/game/:id` loads `index.html`. A simple `vercel.json` is included in this project.
6. Test creating a game and opening its link in an incognito window and on another phone.

## 4. Important prototype limitations
- The starter lets link holders see uploaded photos and submit matches. Do not upload photos without consent.
- The current SQL policies are intentionally permissive for a simple prototype. They can be abused/spammed and are not suitable for a large public launch. Before public promotion, add rate limiting, input validation, deletion/retention controls, and preferably server-side/Edge Function checks.
- Submissions are saved online, but this starter does not yet include a full public results dashboard or aggregate “most popular match” view.
- Character order used: Luffy, Zoro, Nami, Usopp, Sanji, Chopper, Robin, Franky, Brook, Jinbe.
- The supplied Sanji image contains a Shutterstock watermark; replace it with an image you have permission to use before publishing.
- Jujutsu Kaisen selection will be enabled after its character assets are added.
- The app uses a public photo bucket for this prototype. Anyone who obtains a photo URL can view that photo. Use consented photos only.

## 5. JPG export
After a participant submits all 10 matches, the result card can be exported as a JPG. Cross-origin image behavior should be tested after deployment; if a browser blocks export, we can switch to a safer export flow.

## Troubleshooting
- “Online mode is not configured”: `.env` or Vercel environment variables are missing/wrong.
- “Game not found”: check the game ID, database policies, and that the game was created successfully.
- Upload failure: confirm the `friend-photos` bucket exists and storage insert policy was created.
- Never share a Supabase service-role key publicly.
