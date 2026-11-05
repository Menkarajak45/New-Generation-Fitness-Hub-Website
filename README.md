# New Generation Fitness Hub – Public Website

A responsive public business website for New Generation Fitness Hub – Unisex Gym, Ghatkopar West, Mumbai. It includes a public membership enquiry flow and a private owner-only membership plan editor.

## Included
- Public Home, About, Facilities, Membership Plans, Gallery and Contact sections
- Responsive black-and-gold design with the supplied gym video and membership prices transcribed from the membership poster
- Customer membership enquiry form; no customer account or password required
- WhatsApp handoff for enquiries and Pay-at-Gym requests
- Private owner login using the existing admin account
- The private owner plan editor remains available for database-managed plans
- Public membership plans and prices use the schedule transcribed from the supplied poster

## Important setup notes
1. This archive is based on the source ZIP supplied on 5 November 2026. If your local H: drive project has newer changes, back it up and compare before replacing it.
2. Extract the ZIP. Open a terminal in the project folder and run `npm install`.
3. Configure `server/.env` using `server/.env.example`. Set a MongoDB Atlas connection string and a random `JWT_SECRET` of at least 32 characters. Do not publish `.env`.
4. Create the first owner/admin account using the existing `npm run seed:admin` command. The owner signs in from the small **OWNER ACCESS** link in the website footer.
5. Run locally with `npm run dev`. Build with `npm run build`; production server uses `npm start`.
6. For Render, deploy the project as a Web Service with build command `npm install && npm run build` and start command `npm start`. Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, and optional `CLIENT_ORIGIN` in Render environment variables.

## Registration and payments
Customer registration is currently a WhatsApp membership enquiry. Customers do not create accounts or log in. Pay-at-Gym enquiries can be sent through the form. Online payment is **not live** in this package: configure a payment provider such as Razorpay (merchant account, API keys and server-side webhook verification) before accepting online payments. Do not collect card/UPI credentials directly in this website.

## Owner plan management
The owner login uses the existing admin account. Owner access is required to add/edit/hide plans. The public membership price list is maintained from the poster-derived schedule; owner-editor changes continue to manage database plan records but do not replace that public list. Existing purchased membership records are not altered by changing a plan's displayed price.

## Media and image note
The supplied gym video is included in `client/public/assets`. The membership poster is used only as a reference for the displayed plan prices and is not included in the public website. Other gym imagery is illustrative stock photography and is labelled accordingly in the gallery; replace it with actual gym photos when available.

## Gym details in this website
New Generation Fitness Hub – Unisex Gym  
Himalaya Society, Swatantrya Veer Savarkar Road, Ghatkopar West, Mumbai, Maharashtra 400084  
Phone / WhatsApp: +91 72080 56577  
Instagram: @new_generation_fitnesshub

Hours shown from the supplied poster: Men 6 AM–12 PM and 4 PM–12 AM; Women 12 PM–4 PM. Please verify timings and promotional prices before publishing.
