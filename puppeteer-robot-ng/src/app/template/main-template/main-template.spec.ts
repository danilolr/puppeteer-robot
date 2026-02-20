import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainTemplate } from './main-template';

describe('MainTemplate', () => {
  let component: MainTemplate;
  let fixture: ComponentFixture<MainTemplate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainTemplate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainTemplate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
