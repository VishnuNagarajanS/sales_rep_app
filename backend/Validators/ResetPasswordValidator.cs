using backend.DTOs.Auth;
using FluentValidation;

namespace backend.Validators;

public sealed class ResetPasswordValidator : AbstractValidator<ResetPasswordDto>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).MinimumLength(8);
    }
}
