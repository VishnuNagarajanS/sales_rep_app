using backend.DTOs.Consultations;
using FluentValidation;

namespace backend.Validators;

public sealed class ScheduleConsultationValidator : AbstractValidator<ScheduleConsultationDto>
{
    public ScheduleConsultationValidator()
    {
        RuleFor(x => x.InvestorId).NotEmpty();
        RuleFor(x => x.InvestorName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ScheduledAt).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Status).NotEmpty().MaximumLength(40);
    }
}