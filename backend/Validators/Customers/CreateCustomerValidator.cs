using backend.DTOs.Customers;
using FluentValidation;

namespace backend.Validators.Customers;

public class CreateCustomerValidator : AbstractValidator<CreateCustomerDto>
{
    public CreateCustomerValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Customer name is required.")
            .MaximumLength(150).WithMessage("Customer name must not exceed 150 characters.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Contact phone number is required.")
            .MaximumLength(30).WithMessage("Phone number must not exceed 30 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Invalid email format.");
    }
}
