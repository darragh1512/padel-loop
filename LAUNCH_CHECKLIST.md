# Must do before launch

Jobs that have to be done before Padel Loop goes properly public. Tick them off as they're finished.

## Must do

- [ ] **Set up an email service for Padel Loop.** Waiting on the Ltd company, so the addresses can be proper Padel Loop ones. Forgot Password is built and ready, but it can't be relied on until this is done, because Supabase's built-in sender only allows 2 emails an hour across the whole app. Steps:
  1. Own the Padel Loop web address (domain).
  2. Set up the mailboxes people will write to, such as hello@ and support@.
  3. Create an account with an email sending service. Recommended: Resend, whose free plan covers 3,000 emails a month and 100 a day.
  4. Add that service's records to the domain's settings, which proves the emails really come from Padel Loop.
  5. In Supabase, under Authentication, turn on custom SMTP and paste in the service's details. Sender name: Padel Loop.
  6. In Supabase's rate limits, raise the email limit, which starts at around 30 an hour once custom SMTP is on.
  7. Turn off link and click tracking in the sending service, because it can break reset links.
  8. Reword the reset email in Supabase so it sounds like Padel Loop.
  9. Check the Privacy Policy mentions the sending service and uses the new contact address.
  10. Send a real password reset to an iPhone and a Gmail address, and follow the link all the way through.
- [ ] **Add the reset page to Supabase's allowed addresses.** In Authentication, under URL Configuration, add `https://padel-loop-one.vercel.app/reset-password` to Redirect URLs. If the app moves to its own domain, add that address too and update Site URL. Without this, the link in the reset email won't return to the reset page.
- [ ] **Check the new design on a real iPhone.** Screenshots can't prove the status bar, glass effects, keyboard in chat, date and time pickers, or animations.

## Soon after launch

- [ ] **Make the Leaderboard count every match.** Supabase normally returns at most 1,000 rows per request, and each match uses 4 rows, so counts could come up short after about 250 confirmed matches. Fix before the app gets near that number.
