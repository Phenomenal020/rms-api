// Resources: https://docs.nestjs.com/controllers

import { Controller, Get, Req, Post, Body, HttpCode, Header, Redirect, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()  // no prefix declared  for the controller (optional)
export class AppController {

  // dependency injection
  constructor(private readonly appService: AppService) { }

  // get request
  @Get()  // no path declared yet
  @Redirect('https://www.google.com', 301)
  getHello(@Req() request: Request): string {   // method name is arbitrary
    return this.appService.getHello();
  }

  // post request
  @Post()
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  createHello(@Body() body: any): string {
    return "Hello, World!";
  }

  // wildcard route
  @Get('abcd/*')
  findAll() {
    return 'This route uses a wildcard';
  }

  // route param
  @Get('user/:id')
  findOne(@Param('id') id: string) {
    return `User ${id}`;
  }

  // asynchronicity
  @Get()
  async findAllWithPromise(): Promise<any[]> {
    return [];
  }

  // Query param
  @Get()  // GET /cats?age=2&breed=Persian
  async findAllWithQuery(@Query('age') age: number, @Query('breed') breed: string) {
    return `This action returns all cats filtered by age: ${age} and breed: ${breed}`;
  }
}

