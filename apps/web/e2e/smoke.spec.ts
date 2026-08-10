import { test, expect } from "@playwright/test";

test("landing renders TRACE hero", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: /SEE/i })).toBeVisible();
  await expect(page.getByText(/Start monitoring/i)).toBeVisible();
});

test("demo login reaches workspace with seeded project", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email").fill("demo@trace.dev");
  await page.getByLabel("Password").fill("demo-password-change-me");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page.getByText(/Demo Acme/i)).toBeVisible({ timeout: 15000 });
});
