"use client";

import { AppBreadcrumbProvider } from "@/hooks/use-app-breadcrumb";
import { SidebarCalendar } from "@/components/sidebar-calendar";
import ArrowChevronRight from "@gravity-ui/icons/ArrowChevronRight";
import { Header, ListBox, ScrollShadow, Surface, Text } from "@heroui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppChromeProps = {
  children: ReactNode;
};

const nav = [
  { href: "/studio", label: "Studio" },
  { href: "/inbox", label: "Inbox" },
  { href: "/exemplars", label: "Exemplars" },
];

function navItemActive(pathname: string, href: string) {
  if (href === "/studio") {
    if (pathname.startsWith("/studio/calendar")) return false;
    return pathname === "/studio" || pathname.startsWith("/studio/");
  }
  if (href === "/studio/calendar") {
    return (
      pathname === "/studio/calendar" ||
      pathname.startsWith("/studio/calendar/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen min-h-0">

      <ScrollShadow>
        <Surface
          variant="secondary"
          className="flex w-72 shrink-0 flex-col gap-5 p-4 min-h-screen"
        >
          <Text size="lg" className="font-bold">Maya Ops</Text>

          <ListBox
            selectedKeys={new Set(nav.filter((item) => navItemActive(pathname, item.href)).map((item) => item.href))}
            selectionMode="single"
          >
            <ListBox.Section>
              <ListBox.Item render={() => <SidebarCalendar />} />
            </ListBox.Section>
            <ListBox.Section className="mt-4">
              <Header>Navigation</Header>
              {nav.map((item) => (
                <ListBox.Item
                  key={item.href}
                  id={item.href}
                  textValue={item.label}
                  render={({ className, children }) => (
                    <NextLink href={item.href} className={className}>
                      {children}
                    </NextLink>
                  )}
                >
                  {item.label}
                  <ListBox.ItemIndicator>
                    {({ isSelected }) => isSelected ? <ArrowChevronRight className="size-4" aria-hidden /> : null}
                  </ListBox.ItemIndicator>
                </ListBox.Item>
              ))}
            </ListBox.Section>
          </ListBox>
        </Surface>
      </ScrollShadow>

      <ScrollShadow className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
        <AppBreadcrumbProvider>{children}</AppBreadcrumbProvider>
      </ScrollShadow>
    </div>
  );
}
