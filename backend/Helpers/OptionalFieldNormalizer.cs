using System;

namespace backend.Helpers
{
    public static class OptionalFieldNormalizer
    {
        public static string? Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            
            var trimmed = value.Trim();
            
            if (trimmed == "--" || trimmed == "-" || trimmed == "—" || trimmed == "–")
            {
                return null;
            }
            
            if (string.IsNullOrEmpty(trimmed))
            {
                return null;
            }
            
            return trimmed;
        }
    }
}
