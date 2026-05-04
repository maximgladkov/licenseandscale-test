"use client";

import { Link } from "@heroui/react";
import NextLink from "next/link";

export type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
};

export function NavLink({ href, children, isActive }: NavLinkProps) {
  return (
    <NextLink href={href} legacyBehavior passHref>
      <Link aria-current={isActive ? "page" : undefined}>{children}</Link>
    </NextLink>
  );
}
