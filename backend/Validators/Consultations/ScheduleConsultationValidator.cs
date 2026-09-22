using backend.DTOs.Consultations;
using FluentValidation;

namespace backend.Validators.Consultations;

public class ScheduleConsultationValidator : AbstractValidator<ScheduleConsultationDto>
{
    public ScheduleConsultationValidator()
    {
        RuleFor(x => x.InvestorName)
            .NotEmpty().WithMessage("Investor / Client name is required.")
            .MaximumLength(150).WithMessage("Name must not exceed 150 characters.");

        RuleFor(x => x.InvestorPhone)
            .NotEmpty().WithMessage("Phone number is required.")
            .MaximumLength(30).WithMessage("Phone number must not exceed 30 characters.");

        RuleFor(x => x.ScheduledAt)
            .NotEmpty().WithMessage("Scheduled consultation time is required.");
    }
}
