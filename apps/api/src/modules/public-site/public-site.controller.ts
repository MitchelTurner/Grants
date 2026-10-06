import { Controller, Get, Header, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { PublicSiteService } from "./public-site.service";

@Controller()
export class PublicSiteController {
  constructor(private readonly site: PublicSiteService) {}

  @Get()
  @Header("content-type", "text/html; charset=utf-8")
  home() {
    return this.site.home();
  }

  @Get("grants")
  @Header("content-type", "text/html; charset=utf-8")
  grants(@Query() query: Record<string, string | undefined>) {
    return this.site.grants(query);
  }

  @Get("grants/:slug")
  async grant(@Param("slug") slug: string, @Res() res: Response) {
    const html = await this.site.grant(slug);
    if (!html) {
      res
        .status(404)
        .type("html")
        .send(
          this.site.page(
            "Not found · Southeast Grants",
            "That page is not published.",
            "<h1>Not found</h1><p>That opportunity is not published.</p>",
          ),
        );
      return;
    }
    res.type("html").send(html);
  }

  @Get("funders")
  @Header("content-type", "text/html; charset=utf-8")
  funders() {
    return this.site.funders();
  }

  @Get("funders/:slug")
  async funder(@Param("slug") slug: string, @Res() res: Response) {
    const html = await this.site.funder(slug);
    if (!html) {
      res
        .status(404)
        .type("html")
        .send(
          this.site.page(
            "Not found · Southeast Grants",
            "That page is not published.",
            "<h1>Not found</h1><p>That funder is not published.</p>",
          ),
        );
      return;
    }
    res.type("html").send(html);
  }

  @Get("about")
  @Header("content-type", "text/html; charset=utf-8")
  about() {
    return this.site.about();
  }

  @Get("privacy")
  @Header("content-type", "text/html; charset=utf-8")
  privacy() {
    return this.site.privacy();
  }

  @Get("terms")
  @Header("content-type", "text/html; charset=utf-8")
  terms() {
    return this.site.terms();
  }

  @Get("digest/check-email")
  @Header("content-type", "text/html; charset=utf-8")
  checkEmail() {
    return this.site.page(
      "Check your email · Southeast Grants",
      "Confirm the digest.",
      "<h1>Check your email</h1><p>We sent a confirmation link. The digest starts after you open it.</p>",
    );
  }

  @Get("digest/confirmed")
  @Header("content-type", "text/html; charset=utf-8")
  confirmed() {
    return this.site.page(
      "You are subscribed · Southeast Grants",
      "Digest confirmed.",
      "<h1>You are subscribed</h1><p>A curator reviews each issue before it is sent.</p>",
    );
  }

  @Get("digest/unsubscribed")
  @Header("content-type", "text/html; charset=utf-8")
  unsubscribed() {
    return this.site.page(
      "Unsubscribed · Southeast Grants",
      "You left the digest.",
      "<h1>You are unsubscribed</h1><p>You will not get the public digest.</p>",
    );
  }

  @Get("robots.txt")
  @Header("content-type", "text/plain; charset=utf-8")
  robots() {
    return this.site.robots();
  }

  @Get("sitemap.xml")
  @Header("content-type", "application/xml; charset=utf-8")
  sitemap() {
    return this.site.sitemap();
  }
}
