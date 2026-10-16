namespace backend.DTOs.SuperAdmin;

public class SpeechKeywordBoostDto
{
    public string Term { get; set; } = string.Empty;
    public string Category { get; set; } = "Land Metric";
    public double BoostWeight { get; set; } = 3.0; // 1.0 to 5.0
}

public class PhoneticSubstitutionDto
{
    public string SpokenPattern { get; set; } = string.Empty;
    public string NormalizedTarget { get; set; } = string.Empty;
}

public class SpeechVocabularyDto
{
    public string Id { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Language { get; set; } = "English-IN / Multilingual";
    public string LanguageCode { get; set; } = "en-IN";
    public string Engine { get; set; } = "Sarvam AI (Saarika) + Whisper Large-v3";
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<SpeechKeywordBoostDto> Keywords { get; set; } = new();
    public List<PhoneticSubstitutionDto> PhoneticSubstitutions { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class SaveSpeechVocabularyRequestDto
{
    public string? Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Language { get; set; } = "English-IN";
    public string LanguageCode { get; set; } = "en-IN";
    public string Engine { get; set; } = "Sarvam AI (Saarika) + Whisper Large-v3";
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<SpeechKeywordBoostDto> Keywords { get; set; } = new();
    public List<PhoneticSubstitutionDto> PhoneticSubstitutions { get; set; } = new();
}

public class SimulateSpeechRequestDto
{
    public string RawTranscript { get; set; } = string.Empty;
    public string? VocabularyId { get; set; }
}

public class SimulateSpeechResultDto
{
    public string RawTranscript { get; set; } = string.Empty;
    public string NormalizedTranscript { get; set; } = string.Empty;
    public List<string> BoostedTermsMatched { get; set; } = new();
    public List<string> SubstitutionsApplied { get; set; } = new();
    public double AcousticConfidenceGainPercent { get; set; }
    public int ProcessingLatencyMs { get; set; }
    public string EngineUsed { get; set; } = "Sarvam AI Multilingual Acoustics";
}
