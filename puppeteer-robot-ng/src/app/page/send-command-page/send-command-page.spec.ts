import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendCommandPage } from './send-command-page';

describe('SendCommandPage', () => {
  let component: SendCommandPage;
  let fixture: ComponentFixture<SendCommandPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendCommandPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendCommandPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
