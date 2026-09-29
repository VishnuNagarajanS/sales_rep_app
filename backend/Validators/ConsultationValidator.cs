using backend.DTOs.Consultations;
using FluentValidation;

namespace backend.Validators;

public sealed class ScheduleConsultationValidator : AbstractValidator<ScheduleConsultationDto>
{
    public ScheduleConsultationValidator()
    {
        RuleFor(x => x.InvestorId).NotEmpty();
        RuleFor(x => x.InvestorName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ScheduledAt).NotEmpty();
        RuleFor(x => x.Agenda).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Agenda));
        RuleFor(x => x.Notes).MaximumLength(2000).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}