namespace backend.Constants;

public static class InvestmentRouteConstants
{
    public const string Debenture = "debenture";
    public const string DirectAif = "direct_aif";

    // Debenture route: min 1000000 (Rs 10,00,000)
    public const decimal DebentureMinAmount = 1_000_000m;
    
    // Explicit sanity cap constant for Debenture route (defaulted to Rs 100 crore)
    public const decimal DebentureMaxSanityCap = 1_000_000_000m; // Rs 100 crore

    // Direct AIF route: min 10000000 (Rs 1,00,00,000), max 1000000000 (Rs 100 crore, the fund size)
    public const decimal DirectAifMinAmount = 10_000_000m;
    public const decimal DirectAifMaxAmount = 1_000_000_000m; // Rs 100 crore (Fund size)

    public static (bool IsValid, string? ErrorMessage) ValidateInvestmentAmount(decimal amount, string? route)
    {
        if (string.IsNullOrWhiteSpace(route))
        {
            return (false, "Investment route must be selected ('debenture' or 'direct_aif') before confirming amount.");
        }

        var normalizedRoute = route.Trim().ToLowerInvariant();

        if (normalizedRoute.Contains("debenture"))
        {
            if (amount <= 0)
                return (false, "Investment amount must be a positive number.");
            if (amount < DebentureMinAmount)
                return (false, $"Minimum investment for Alternate route to Invest in AIF via Debenture is Rs {DebentureMinAmount:N0}.");
            if (amount > DebentureMaxSanityCap)
                return (false, $"Maximum investment for Alternate route to Invest in AIF via Debenture is Rs {DebentureMaxSanityCap:N0}.");

            return (true, null);
        }
        else if (normalizedRoute.Contains("direct") || normalizedRoute == DirectAif)
        {
            if (amount <= 0)
                return (false, "Investment amount must be a positive number.");
            if (amount < DirectAifMinAmount)
                return (false, $"Minimum investment for Direct AIF Route is Rs {DirectAifMinAmount:N0}.");
            if (amount > DirectAifMaxAmount)
                return (false, $"Maximum investment for Direct AIF Route is Rs {DirectAifMaxAmount:N0}.");

            return (true, null);
        }

        return (false, $"Unknown investment route '{route}'. Allowed routes are 'debenture' and 'direct_aif'.");
    }
}
