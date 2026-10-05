import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const body = await this.health.check();
    res.status(body.status === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }
}
