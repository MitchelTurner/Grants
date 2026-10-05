import { Controller, Get } from "@nestjs/common";

/**
 * Temporary origin response until the public site (M7) replaces it.
 * SPEC-QUESTION: §6 shows `/` as server-rendered marketing pages. M0 only
 * proves the process is serving HTTP.
 */
@Controller()
export class RootController {
  @Get()
  home() {
    return {
      name: "Southeast Grants",
      health: "/health",
    };
  }
}
