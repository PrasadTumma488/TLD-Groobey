import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  BadgeCheck,
  Bike,
  Carrot,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  Loader2,
  LockKeyhole,
  Mail,
  PackagePlus,
  Phone,
  Plus,
  ReceiptText,
  ShieldCheck,
  Store,
  Truck,
  UserCog,
  UsersRound,
} from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createStaffAccount, getSetupStatus, saveShopDetails } from "@/lib/tldGroobey.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TLD Groobey Grocery Operations" },
      {
        name: "description",
        content: "Secure owner, admin, merchant, and employee grocery operations for TLD Groobey.",
      },
      { property: "og:title", content: "TLD Groobey Grocery Operations" },
      {
        property: "og:description",
        content: "Manage grocery prices, sales, shops, and attendance from one secure dashboard.",
      },
    ],
  }),
  component: Index,
});

type AppRole = Database["public"]["Enums"]["app_role"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AuthAction = "" | "password" | "otp";

const starterProducts = [
  { name: "Tomato", category: "Vegetables", unit: "kg", price: 42 },
  { name: "Onion", category: "Vegetables", unit: "kg", price: 36 },
  { name: "Potato", category: "Vegetables", unit: "kg", price: 34 },
  { name: "Carrot", category: "Vegetables", unit: "kg", price: 54 },
  { name: "Beans", category: "Vegetables", unit: "kg", price: 82 },
  { name: "Cabbage", category: "Vegetables", unit: "piece", price: 38 },
  { name: "Cauliflower", category: "Vegetables", unit: "piece", price: 46 },
  { name: "Brinjal", category: "Vegetables", unit: "kg", price: 48 },
  { name: "Capsicum", category: "Vegetables", unit: "kg", price: 88 },
  { name: "Green Chilli", category: "Vegetables", unit: "kg", price: 96 },
  { name: "Coriander", category: "Greens", unit: "bunch", price: 18 },
  { name: "Spinach", category: "Greens", unit: "bunch", price: 24 },
  { name: "Banana", category: "Fruits", unit: "dozen", price: 72 },
  { name: "Apple", category: "Fruits", unit: "kg", price: 180 },
  { name: "Orange", category: "Fruits", unit: "kg", price: 110 },
  { name: "Mango", category: "Fruits", unit: "kg", price: 140 },
  { name: "Grapes", category: "Fruits", unit: "kg", price: 120 },
  { name: "Watermelon", category: "Fruits", unit: "piece", price: 90 },
  { name: "Rice Sona Masoori", category: "Staples", unit: "kg", price: 68 },
  { name: "Wheat Atta", category: "Staples", unit: "kg", price: 52 },
  { name: "Toor Dal", category: "Staples", unit: "kg", price: 156 },
  { name: "Urad Dal", category: "Staples", unit: "kg", price: 142 },
  { name: "Sugar", category: "Staples", unit: "kg", price: 46 },
  { name: "Salt", category: "Staples", unit: "kg", price: 24 },
  { name: "Milk", category: "Dairy", unit: "litre", price: 58 },
  { name: "Curd", category: "Dairy", unit: "500g", price: 34 },
  { name: "Paneer", category: "Dairy", unit: "200g", price: 92 },
  { name: "Butter", category: "Dairy", unit: "100g", price: 58 },
  { name: "Groundnut Oil", category: "Kitchen", unit: "litre", price: 168 },
  { name: "Sunflower Oil", category: "Kitchen", unit: "litre", price: 148 },
  { name: "Turmeric Powder", category: "Kitchen", unit: "100g", price: 36 },
  { name: "Chilli Powder", category: "Kitchen", unit: "100g", price: 44 },
  { name: "Tea Powder", category: "Kitchen", unit: "250g", price: 130 },
  { name: "Coffee Powder", category: "Kitchen", unit: "200g", price: 165 },
];

const roleLabels: Record<AppRole, string> = {
  main_admin: "Owner",
  admin: "Admin",
  merchant: "Merchant",
  employee: "Employee",
};

const transientDatabaseMessages = ["schema cache", "retrying", "not accepting connections", "recovery mode", "failed to fetch"];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function isTransientDatabaseError(message = "") {
  const normalized = message.toLowerCase();
  return transientDatabaseMessages.some((item) => normalized.includes(item));
}

async function retryTransient<T>(operation: () => Promise<T>, getMessage: (result: T) => string | undefined, attempts = 3) {
  let lastResult: T | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await operation();
    const message = getMessage(lastResult);
    if (!message || !isTransientDatabaseError(message)) return lastResult;
    await wait(400 + attempt * 500);
  }
  return lastResult as T;
}

function phoneCandidates(identifier: string) {
  const compact = identifier.replace(/[\s()-]/g, "");
  const digits = compact.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (compact.startsWith("+") && digits.length >= 10) candidates.add(`+${digits}`);
  if (digits.length === 10) candidates.add(`+91${digits}`);
  if (digits.length > 10) candidates.add(`+${digits}`);
  candidates.add(identifier);

  return Array.from(candidates).filter(Boolean);
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("phone provider") || normalized.includes("sms")) {
    return "Mobile OTP is not active yet. Please use email OTP or password login for now.";
  }
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return "Login details are not matching. Check the email/mobile number and password.";
  }
  return message;
}

function Index() {
  const createAccount = useServerFn(createStaffAccount);
  const setupStatus = useServerFn(getSetupStatus);
  const saveShop = useServerFn(saveShopDetails);
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [hasOwner, setHasOwner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [authAction, setAuthAction] = useState<AuthAction>("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pointer, setPointer] = useState({ x: "72%", y: "18%" });
  const workspaceRequestRef = useRef(0);

  const activeRole = roles[0];
  const isOwner = roles.includes("main_admin");
  const isAdminLike = roles.includes("main_admin") || roles.includes("admin");
  const isMerchant = roles.includes("merchant");
  const isEmployee = roles.includes("employee");

  useEffect(() => {
    let mounted = true;

    setupStatus()
      .then((status) => mounted && setHasOwner(status.hasOwner))
      .catch(() => mounted && setHasOwner(true));

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [setupStatus]);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setRoles([]);
      setProducts([]);
      setShops([]);
      setSales([]);
      setAttendance([]);
      return;
    }

    void loadWorkspace();
  }, [session?.user?.id]);

  async function loadWorkspace() {
    if (!session?.user) return;
    const requestId = workspaceRequestRef.current + 1;
    workspaceRequestRef.current = requestId;
    setLoading(true);
    setError("");

    const [profileRes, rolesRes, productsRes, shopsRes, salesRes, attendanceRes] = await retryTransient(
      () => Promise.all([
        supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase.from("products").select("*").order("category", { ascending: true }).order("name"),
        supabase.from("shops").select("*").order("name"),
        supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("attendance").select("*").order("work_date", { ascending: false }).limit(50),
      ]),
      (responses) => responses.map((response) => response.error?.message).find(Boolean),
    );

    if (requestId !== workspaceRequestRef.current) return;
    setLoading(false);
    const workspaceError = [profileRes, rolesRes, productsRes, shopsRes, salesRes, attendanceRes].map((response) => response.error?.message).find(Boolean);
    if (workspaceError) {
      setError(isTransientDatabaseError(workspaceError) ? "Refreshing your workspace. Please wait a moment." : workspaceError);
      if (isTransientDatabaseError(workspaceError)) window.setTimeout(() => void loadWorkspace(), 900);
      return;
    }

    setProfile(profileRes.data ?? null);
    setRoles((rolesRes.data ?? []).map((item) => item.role));
    setProducts(productsRes.data ?? []);
    setShops(shopsRes.data ?? []);
    setSales(salesRes.data ?? []);
    setAttendance(attendanceRes.data ?? []);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setAuthAction("password");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "").trim();
    const password = String(form.get("password") || "");
    const isEmail = identifier.includes("@");

    const { error: loginError } = isEmail
      ? await supabase.auth.signInWithPassword({ email: identifier, password })
      : await signInWithPhonePassword(identifier, password);

    setAuthAction("");
    if (loginError) setError(friendlyAuthError(loginError.message));
  }

  async function handleOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setAuthAction("otp");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("otpIdentifier") || "").trim();
    const isEmail = identifier.includes("@");

    const { error: otpError } = isEmail
      ? await supabase.auth.signInWithOtp({ email: identifier })
      : await signInWithPhoneOtp(identifier);

    setAuthAction("");
    if (otpError) setError(friendlyAuthError(otpError.message));
    else setNotice("One-time login code sent.");
  }

  async function signInWithPhonePassword(identifier: string, password: string) {
    let lastError: { message: string } | null = null;
    for (const phone of phoneCandidates(identifier)) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ phone, password });
      if (!loginError) return { error: null };
      lastError = loginError;
      if (!loginError.message.toLowerCase().includes("invalid")) break;
    }
    return { error: lastError };
  }

  async function signInWithPhoneOtp(identifier: string) {
    let lastError: { message: string } | null = null;
    for (const phone of phoneCandidates(identifier)) {
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
      if (!otpError) return { error: null };
      lastError = otpError;
      if (otpError.message.toLowerCase().includes("phone provider")) break;
    }
    return { error: lastError };
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const role = String(form.get("role")) as AppRole;

    try {
      await createAccount({
        data: {
          requesterToken: session?.access_token,
          displayName: String(form.get("displayName") || ""),
          email: String(form.get("email") || ""),
          phone: String(form.get("phone") || ""),
          password: String(form.get("newPassword") || ""),
          role,
        },
      });
      setHasOwner(true);
      setNotice(`${roleLabels[role]} account created.`);
      event.currentTarget.reset();
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : "Unable to create account.");
    }
  }

  async function seedProducts() {
    setError("");
    const { error: seedError } = await supabase.from("products").insert(
      starterProducts.map((product) => ({ ...product, created_by: session?.user.id })) as never,
    );
    if (seedError) setError(seedError.message);
    else {
      setNotice("Starter grocery list added.");
      void loadWorkspace();
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error: productError } = await supabase.from("products").insert({
      name: String(form.get("name") || ""),
      category: String(form.get("category") || "General"),
      unit: String(form.get("unit") || "piece"),
      price: Number(form.get("price") || 0),
      created_by: session?.user.id,
    } as never);

    if (productError) setError(productError.message);
    else {
      event.currentTarget.reset();
      setNotice("Product added.");
      void loadWorkspace();
    }
  }

  async function addShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error: shopError } = await supabase.from("shops").insert({
      name: String(form.get("shopName") || ""),
      contact_name: String(form.get("contactName") || "") || null,
      phone: String(form.get("shopPhone") || "") || null,
      address: String(form.get("address") || "") || null,
      created_by: session?.user.id,
    } as never);

    if (shopError) setError(shopError.message);
    else {
      event.currentTarget.reset();
      setNotice("Shop added. It will now appear in shop dropdowns.");
      void loadWorkspace();
    }
  }

  async function handleMerchantShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await saveShop({
        data: {
          requesterToken: session?.access_token || "",
          name: String(form.get("shopName") || ""),
          contactName: String(form.get("contactName") || ""),
          phone: String(form.get("shopPhone") || ""),
          address: String(form.get("address") || ""),
        },
      });
      event.currentTarget.reset();
      setNotice("Shop details saved for owner review.");
      void loadWorkspace();
    } catch (shopError) {
      setError(shopError instanceof Error ? shopError.message : "Unable to save shop details.");
    }
  }

  async function submitAttendance() {
    if (!session?.user) return;
    setError("");
    setNotice("");
    const { error: attendanceError } = await supabase.from("attendance").upsert({
      worker_id: session.user.id,
      work_date: new Date().toISOString().slice(0, 10),
      status: "present",
      check_in: new Date().toISOString(),
      notes: "Submitted from TLD Groobey dashboard",
    } as never);

    if (attendanceError) setError(attendanceError.message);
    else {
      setNotice("Attendance submitted for owner verification.");
      void loadWorkspace();
    }
  }

  const groupedProducts = useMemo(() => {
    return products.reduce<Record<string, Product[]>>((groups, product) => {
      groups[product.category] = [...(groups[product.category] ?? []), product];
      return groups;
    }, {});
  }, [products]);

  if (!session) {
    return (
      <main
        className="groobey-shell min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 lg:px-10"
        style={{ "--pointer-x": pointer.x, "--pointer-y": pointer.y } as CSSProperties}
        onPointerMove={(event) => {
          setPointer({ x: `${Math.round((event.clientX / window.innerWidth) * 100)}%`, y: `${Math.round((event.clientY / window.innerHeight) * 100)}%` });
        }}
      >
        <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold shadow-soft">
              <Carrot className="size-4 text-primary" /> TLD Groobey
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
                Grocery work, prices, sales and attendance in one secure scroll.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Owner, admins, merchants, and employees each get separate access. The owner can monitor everything while others only handle their own work.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <Stat icon={ShieldCheck} label="Owner control" value="Main" />
              <Stat icon={Store} label="Merchant scope" value="Own" />
              <Stat icon={Bike} label="Employees" value="Tracked" />
            </div>
          </div>

          <div className="groobey-card rounded-2xl border border-border p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">Secure login</p>
                <h2 className="text-2xl font-black text-foreground">Enter TLD Groobey</h2>
              </div>
              <div className="groobey-hero-gradient groobey-float flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
                <LockKeyhole className="size-6" />
              </div>
            </div>

            {!hasOwner && <OwnerSetupForm onCreate={handleCreateAccount} />}
            {hasOwner && (
              <div className="space-y-5">
                <form className="space-y-3" onSubmit={handleLogin}>
                  <Field name="identifier" label="Email or mobile number" icon={Mail} required />
                  <Field name="password" label="Password" type="password" icon={LockKeyhole} required />
                  <Button className="h-11 w-full rounded-xl" variant="groobey" type="submit" disabled={authAction === "password"}>
                    {authAction === "password" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Login
                  </Button>
                </form>
                <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> OTP access <span className="h-px flex-1 bg-border" />
                </div>
                <form className="flex gap-2" onSubmit={handleOtp}>
                  <input name="otpIdentifier" className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none ring-ring transition focus:ring-2" placeholder="Email or mobile" />
                  <Button variant="calm" type="submit" className="h-11 rounded-xl" disabled={authAction === "otp"}>
                    {authAction === "otp" && <Loader2 className="size-4 animate-spin" />} Send OTP
                  </Button>
                </form>
              </div>
            )}
            <Message error={error} notice={notice} loading={loading} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="groobey-shell min-h-screen text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="groobey-hero-gradient flex size-11 items-center justify-center rounded-xl text-primary-foreground"><Carrot className="size-5" /></div>
            <div>
              <p className="text-lg font-black leading-none">TLD Groobey</p>
              <p className="text-xs font-semibold text-muted-foreground">{profile?.display_name || session.user.email || session.user.phone} · {activeRole ? roleLabels[activeRole] : "Staff"}</p>
            </div>
          </div>
          <Button variant="calm" onClick={() => supabase.auth.signOut()} className="rounded-xl">Logout</Button>
        </div>
      </header>

      <div className="mx-auto flex max-h-[calc(100vh-68px)] max-w-7xl flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10 groobey-scrollbar">
        <section className="grid gap-4 md:grid-cols-4">
          <Stat icon={PackagePlus} label="Products" value={products.length.toString()} />
          <Stat icon={Store} label="Shops" value={shops.length.toString()} />
          <Stat icon={ReceiptText} label="Submissions" value={sales.length.toString()} />
          <Stat icon={ClipboardList} label="Attendance" value={attendance.length.toString()} />
        </section>

        <Message error={error} notice={notice} loading={loading} />

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Panel title="Grocery list with live costs" icon={IndianRupee} action={isOwner && products.length === 0 ? <Button variant="groobey" onClick={seedProducts} className="rounded-xl"><Plus className="size-4" /> Add starter list</Button> : null}>
            <div className="max-h-[29rem] space-y-4 overflow-y-auto pr-1 groobey-scrollbar">
              {Object.entries(groupedProducts).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-normal text-muted-foreground">{category}</h3>
                  <div className="grid gap-2">
                    {items.map((item) => <ProductRow key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
              {products.length === 0 && <EmptyState icon={Carrot} title="No grocery items yet" text="The owner can add products here without changing code." />}
            </div>
          </Panel>

          <Panel title={isOwner ? "Create separate logins" : isMerchant ? "Merchant shop and sale work" : isEmployee ? "Employee work details" : "Admin operations"} icon={UsersRound}>
            {isOwner && <AccountForm onCreate={handleCreateAccount} />}
            {isMerchant && <MerchantWorkspace products={products} shops={shops} userId={session.user.id} onSaveShop={handleMerchantShop} onDone={loadWorkspace} onError={setError} />}
            {isEmployee && <EmployeeWorkspace profile={profile} onSubmitAttendance={submitAttendance} />}
            {!isOwner && !isMerchant && !isEmployee && <EmptyState icon={ShieldCheck} title="Admin login active" text="Use the product, shop, attendance, and verification sections below." />}
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {isOwner && (
            <Panel title="Add product" icon={PackagePlus}>
              <form className="grid gap-3" onSubmit={addProduct}>
                <Field name="name" label="Product name" required />
                <Field name="category" label="Category" required />
                <div className="grid grid-cols-2 gap-3"><Field name="unit" label="Unit" required /><Field name="price" label="Cost" type="number" required /></div>
                <Button variant="groobey" className="rounded-xl"><Plus className="size-4" /> Add grocery</Button>
              </form>
            </Panel>
          )}
          {isAdminLike && (
            <Panel title="Add shop name" icon={Store}>
              <ShopDetailsForm onSubmit={addShop} buttonText="Add shop" />
            </Panel>
          )}
          <Panel title="Attendance" icon={ClipboardList}>
            <div className="space-y-3">
              {!isOwner && <Button variant="groobey" onClick={submitAttendance} className="w-full rounded-xl"><CheckCircle2 className="size-4" /> Mark present</Button>}
              <Records items={attendance.map((item) => `${item.work_date} · ${item.status} · ${item.verification_status}`)} empty="No attendance records." />
            </div>
          </Panel>
          {isAdminLike && <Panel title="Verification queue" icon={BadgeCheck}><Records items={[...sales.map((sale) => `Sale ${sale.id.slice(0, 8)} · ${sale.status}`), ...attendance.map((item) => `Attendance ${item.work_date} · ${item.verification_status}`)]} empty="Nothing waiting for verification." /></Panel>}
        </section>
      </div>
    </main>
  );
}

function AccountForm({ onCreate }: { onCreate: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="grid gap-3" onSubmit={onCreate}>
      <Field name="displayName" label="Name" icon={UserCog} required />
      <div className="grid gap-3 sm:grid-cols-2"><Field name="email" label="Email" icon={Mail} /><Field name="phone" label="Mobile number" icon={Phone} /></div>
      <select name="role" className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2" defaultValue="merchant">
        <option value="admin">Admin</option><option value="merchant">Merchant</option><option value="employee">Employee / Delivery boy</option>
      </select>
      <Field name="newPassword" label="Temporary password" type="password" icon={LockKeyhole} required />
      <Button variant="groobey" className="rounded-xl"><Plus className="size-4" /> Create login</Button>
    </form>
  );
}

function OwnerSetupForm({ onCreate }: { onCreate: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="space-y-4"><div className="rounded-xl border border-warning bg-warning/15 p-3 text-sm font-semibold text-warning-foreground">First create the owner login. Public signup is disabled.</div><form className="grid gap-3" onSubmit={onCreate}><input type="hidden" name="role" value="main_admin" /><Field name="displayName" label="Owner name" required /><Field name="email" label="Owner email" icon={Mail} /><Field name="phone" label="Owner mobile" icon={Phone} /><Field name="newPassword" label="Owner password" type="password" icon={LockKeyhole} required /><Button variant="groobey" className="rounded-xl">Create owner login</Button></form></div>;
}

function MerchantWorkspace({ products, shops, userId, onSaveShop, onDone, onError }: { products: Product[]; shops: Shop[]; userId: string; onSaveShop: (event: FormEvent<HTMLFormElement>) => void; onDone: () => void; onError: (message: string) => void }) {
  return <div className="grid gap-5"><ShopDetailsForm onSubmit={onSaveShop} buttonText="Save my shop details" /><WorkForm products={products} shops={shops} userId={userId} onDone={onDone} onError={onError} /></div>;
}

function EmployeeWorkspace({ profile, onSubmitAttendance }: { profile: Profile | null; onSubmitAttendance: () => void }) {
  return <div className="grid gap-3"><div className="rounded-xl border border-border bg-card/70 p-3 text-sm font-semibold"><div className="flex items-center gap-2"><Truck className="size-4 text-primary" /> Employee details</div><p className="mt-2 text-muted-foreground">{profile?.display_name || "Employee"} · {profile?.email || profile?.phone || "Login profile"}</p></div><Button variant="groobey" onClick={onSubmitAttendance} className="rounded-xl"><CheckCircle2 className="size-4" /> Submit today's attendance</Button></div>;
}

function ShopDetailsForm({ onSubmit, buttonText }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; buttonText: string }) {
  return <form className="grid gap-3" onSubmit={onSubmit}><Field name="shopName" label="Shop name" icon={Store} required /><Field name="contactName" label="Contact person" icon={UserCog} /><Field name="shopPhone" label="Shop mobile number" icon={Phone} /><Field name="address" label="Shop address" /><Button variant="groobey" className="rounded-xl"><Store className="size-4" /> {buttonText}</Button></form>;
}

function WorkForm({ products, shops, userId, onDone, onError }: { products: Product[]; shops: Shop[]; userId: string; onDone: () => void; onError: (message: string) => void }) {
  const [destination, setDestination] = useState("shop");

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product = products.find((item) => item.id === form.get("productId"));
    if (!product) return onError("Choose a product first.");
    const selectedDestination = String(form.get("destination"));
    if (selectedDestination === "shop" && !form.get("shopId")) return onError("Add or choose a shop name first.");
    const { data: sale, error: saleError } = await supabase.from("sales").insert({ created_by: userId, destination_type: selectedDestination, shop_id: selectedDestination === "shop" ? String(form.get("shopId")) : null, other_shop_name: selectedDestination === "other" ? String(form.get("otherShop") || "") : null, notes: String(form.get("notes") || "") } as never).select("id").single();
    if (saleError || !sale) return onError(saleError?.message || "Unable to submit sale.");
    const { error: itemError } = await supabase.from("sale_items").insert({ sale_id: sale.id, product_id: product.id, product_name: product.name, quantity: Number(form.get("quantity") || 1), unit_price: product.price } as never);
    if (itemError) return onError(itemError.message);
    event.currentTarget.reset();
    setDestination("shop");
    onDone();
  }

  return <form className="grid gap-3" onSubmit={submitSale}><select name="productId" className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2" defaultValue=""><option value="" disabled>{products.length ? "Choose grocery item" : "Owner must add grocery list first"}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · ₹{product.price}/{product.unit}</option>)}</select><Field name="quantity" label="Quantity" type="number" required /><select name="destination" value={destination} onChange={(event) => setDestination(event.target.value)} className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"><option value="shop">Shop name</option><option value="self">Self</option><option value="other">Others</option></select>{destination === "shop" && <select name="shopId" className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2" defaultValue=""><option value="" disabled>{shops.length ? "Choose shop name" : "No shop names saved yet"}</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>}{destination === "other" && <Field name="otherShop" label="Other shop name" required />}<Field name="notes" label="Notes" /><Button variant="groobey" className="rounded-xl" disabled={!products.length || (destination === "shop" && !shops.length)}><ReceiptText className="size-4" /> Submit sale</Button></form>;
}

function Field({ name, label, type = "text", icon: Icon, required = false }: { name: string; label: string; type?: string; icon?: typeof Mail; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>{label}</span><span className="flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 ring-ring transition focus-within:ring-2">{Icon && <Icon className="size-4 text-muted-foreground" />}<input name={name} type={type} required={required} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></span></label>;
}

function Panel({ title, icon: Icon, children, action }: { title: string; icon: typeof Carrot; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="groobey-card rounded-2xl border border-border p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Icon className="size-5 text-primary" /><h2 className="text-xl font-black">{title}</h2></div>{action}</div>{children}</section>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Carrot; label: string; value: string }) {
  return <div className="groobey-card rounded-2xl border border-border p-4"><Icon className="mb-3 size-5 text-primary" /><p className="text-2xl font-black">{value}</p><p className="text-sm font-semibold text-muted-foreground">{label}</p></div>;
}

function ProductRow({ item }: { item: Product }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-3 transition hover:translate-x-1"><div><p className="font-black">{item.name}</p><p className="text-xs font-semibold text-muted-foreground">{item.unit}</p></div><div className="rounded-full bg-secondary px-3 py-1 text-sm font-black text-secondary-foreground">₹{item.price}</div></div>;
}

function Records({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <EmptyState icon={AlertCircle} title={empty} text="New records will appear here automatically." />;
  return <div className="max-h-52 space-y-2 overflow-y-auto groobey-scrollbar">{items.map((item) => <div key={item} className="rounded-xl border border-border bg-card/70 p-3 text-sm font-semibold">{item}</div>)}</div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Carrot; title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-5 text-center"><Icon className="mx-auto mb-2 size-6 text-primary" /><p className="font-black">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>;
}

function Message({ error, notice, loading }: { error: string; notice: string; loading: boolean }) {
  if (loading) return <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold"><Loader2 className="size-4 animate-spin text-primary" /> Loading</div>;
  if (error) return <div className="mt-4 rounded-xl border border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</div>;
  if (notice) return <div className="mt-4 rounded-xl border border-success bg-success/10 p-3 text-sm font-semibold text-success">{notice}</div>;
  return null;
}