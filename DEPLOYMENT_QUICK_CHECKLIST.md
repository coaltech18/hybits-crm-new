# ⚡ QUICK DEPLOYMENT CHECKLIST
**For Tomorrow's Delivery**

---

## 🔴 CRITICAL - DO THESE FIRST (30 minutes)

### 1. Fix Database RLS Issue ⚠️ **BLOCKER**
```sql
-- Go to Supabase Dashboard > SQL Editor
-- Copy and paste entire file: supabase/011_fix_user_profiles_rls.sql
-- Click "Run"
-- Verify: Check for errors, should see "Success"
```

**Verify:** Try logging in - should work now

---

### 2. Set Environment Variables in Render ⚠️ **BLOCKER**
```
1. Go to Render Dashboard
2. Select your service: "hybits-crm"
3. Go to "Environment" tab
4. Add these variables:
   - VITE_SUPABASE_URL = https://your-project.supabase.co
   - VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
5. Save
```

**Verify:** Check Render logs after deployment

---

### 3. Run All Database Migrations ⚠️ **BLOCKER**
```
Go to Supabase Dashboard > SQL Editor
Run these files IN ORDER:

1. 001_Core_Base_Schema.sql
2. 002_auth_and_rbac.sql
3. 003_customers_and_contacts.sql
4. 004_inventory_and_movements.sql
5. 005_orders_and_invoices.sql
6. 010_user_management_triggers.sql
7. 011_fix_user_profiles_rls.sql (CRITICAL - run last!)
```

**Verify:** Check tables exist in Supabase Dashboard > Table Editor

---

## ✅ ALREADY FIXED

- [x] Build dependencies (vite plugin upgraded)
- [x] Render build command (--legacy-peer-deps added)
- [x] TypeScript error (fixed in create-profile.ts)

---

## 🚀 DEPLOYMENT STEPS (15 minutes)

### Step 1: Test Build Locally
```bash
npm install --legacy-peer-deps
npm run build
# Should succeed without errors
```

### Step 2: Commit and Push
```bash
git add .
git commit -m "Production ready: Fix RLS, TypeScript, deployment config"
git push origin main
```

### Step 3: Monitor Deployment
- Go to Render Dashboard
- Watch deployment logs
- Should complete in 2-5 minutes

---

## ✅ POST-DEPLOYMENT VERIFICATION (15 minutes)

### Test These:
- [ ] Application loads at your Render URL
- [ ] Login page appears
- [ ] Can log in with test credentials
- [ ] Dashboard loads after login
- [ ] No console errors (check browser DevTools)
- [ ] All modules accessible

### If Login Fails:
1. Check Supabase Dashboard > Authentication > Users
2. Verify user exists
3. Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'user_profiles';`
4. Re-run migration `011_fix_user_profiles_rls.sql`

---

## 📞 IF SOMETHING GOES WRONG

### Build Fails:
- Check Render logs
- Verify `package.json` dependencies
- Try: `npm install --legacy-peer-deps` locally first

### Login Fails:
- Check Supabase RLS policies
- Verify environment variables set correctly
- Check browser console for errors

### Database Errors:
- Verify all migrations ran successfully
- Check Supabase logs
- Re-run migrations if needed

---

## 🎯 FINAL CHECKLIST

Before marking as "Ready for Production":

- [ ] All critical issues fixed
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Build succeeds
- [ ] Deployment successful
- [ ] Login works
- [ ] Core features tested
- [ ] No console errors

---

**Total Time:** ~1 hour  
**Status:** Ready after critical fixes

