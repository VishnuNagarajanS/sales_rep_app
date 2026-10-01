namespace backend.Models.Enums;

public enum KycStatus
{
    /// <summary>Not yet sent — IRM created the record but has not dispatched the link.</summary>
    Draft,
    /// <summary>KYC link sent to the customer. Awaiting customer submission.</summary>
    LinkSent,
    /// <summary>Customer has submitted the KYC form. Awaiting IRM review/verification.</summary>
    PendingReview,
    Approved,
    Rejected,
    ReuploadRequested
}
