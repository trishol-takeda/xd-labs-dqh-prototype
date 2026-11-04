import { Injectable } from '@angular/core';
import { MY_DOMAIN_DATA_FILES } from './my-domain.constants';
import { DemoExecution, DomainCatalogue, MyDomainDataset, RuleRepository } from './my-domain.model';

/**
 * The only thing the My Domain screens know about where data comes from.
 * Replace the provider in app.config.ts with an HTTP implementation to go live; no component changes.
 */
export abstract class MyDomainApi {
  abstract load(): Promise<MyDomainDataset>;
}

/** Reads the three static JSON files: repository (from the workbook), catalogue (design), demo execution (synthetic). */
@Injectable()
export class MockMyDomainApi extends MyDomainApi {
  async load(): Promise<MyDomainDataset> {
    const [repository, catalogue, demo] = await Promise.all([
      this.json<RuleRepository>(MY_DOMAIN_DATA_FILES.repository),
      this.json<DomainCatalogue>(MY_DOMAIN_DATA_FILES.catalogue),
      this.json<DemoExecution>(MY_DOMAIN_DATA_FILES.demo),
    ]);
    return { repository, catalogue, demo };
  }

  private async json<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    return (await response.json()) as T;
  }
}
