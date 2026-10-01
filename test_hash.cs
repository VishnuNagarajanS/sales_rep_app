using System;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;
using System.Text;

public class Program {
    public static void Main() {
        bool result = BCrypt.Net.BCrypt.Verify(""Password@123"", ""$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p."");
        Console.WriteLine(""Matches: "" + result);
    }
}
