import { NewsletterForm } from "@/components/site/newsletter-form";

export function NewsletterSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-surface px-6 py-14 text-center sm:px-10">
      <div className="mx-auto max-w-xl space-y-4">
        <h2 className="text-3xl font-semibold md:text-4xl">Restez au courant des nouveautés</h2>
        <p className="text-muted-foreground">
          Lancements, arrivages et bons plans : recevez les nouvelles de Fryle avant tout le monde.
        </p>
        <NewsletterForm className="mx-auto max-w-md pt-2" />
      </div>
    </section>
  );
}
