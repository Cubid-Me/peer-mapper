export default function SignInPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Sign in with Cubid</h1>
      <p className="text-muted-foreground">
        Connect your Cubid identity and EVM wallet to start building trust circles.
      </p>
      <button className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
        Continue
      </button>
    </section>
  );
}
