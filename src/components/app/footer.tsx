import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex h-24 items-center justify-center">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="text-sm">Um produto da</span>
          <Link href="https://www.linkedin.com/company/vitra-ventures/" target="_blank" rel="noopener noreferrer">
            <Image
              src="https://media.licdn.com/dms/image/C4D0BAQF3_3T9Y5d5DQ/company-logo_200_200/0/1660339230553/vitra_ventures_logo?e=2147483647&v=beta&t=7lO-x_5Y4fCjRlB8XG4-o9Z9j_4nQ0pZ9e1bBwXg3zA"
              alt="Vitra Logo"
              width={80}
              height={25}
              className="object-contain"
            />
          </Link>
        </div>
      </div>
    </footer>
  );
}
