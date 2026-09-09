import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4">
      <div className="text-center">
        <BrandMark className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-5 font-display text-xl font-bold">Nie ma takiej strony</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Adres nie odpowiada żadnej księdze ani rozdziałowi. Wróć do wyboru księgi i zacznij od nowa.
        </p>
        <Button asChild className="mt-6" data-testid="link-home-404">
          <Link href="/">Wybór księgi</Link>
        </Button>
      </div>
    </div>
  );
}
