// Resources: https://docs.nestjs.com/controllers

import { Controller } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()  // no prefix declared  for the controller (optional)
export class AppController {

  // dependency injection
  constructor(private readonly appService: AppService) { }
}